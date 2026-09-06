export type VideoReferenceImage = { uri:string; mimeType:string; label?:string; referenceId?:string; priority?:number; role?:string }

export type VideoGenerationRequest = {
  prompt: string
  referenceImages?: VideoReferenceImage[]
  aspectRatio?: '16:9' | '9:16'
  resolution?: '720p' | '1080p' | '4k'
  duration?: 4 | 6 | 8
}

export type VideoGenerationStart = {
  provider: 'google-veo'
  model: string
  operationName: string
  status: 'queued' | 'running'
  message: string
}

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export async function startVideoGeneration(input: VideoGenerationRequest): Promise<VideoGenerationStart> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not configured. Add it to enable real moving-video generation.')

  const model = process.env.VIDEO_MODEL || 'veo-3.1-generate-preview'
  const duration = input.duration ?? 8
  const resolution = input.resolution ?? '1080p'
  const aspectRatio = input.aspectRatio ?? '16:9'

  // Veo 3.1 uses a long-running operation. 1080p/4K requests are 8 seconds.
  const referenceImages = [] as any[]
  for (const ref of (input.referenceImages || []).slice(0, 3)) {
    if (!ref.uri) continue
    let imageBytes:Buffer
    if (ref.uri.startsWith('data:')) {
      const m=ref.uri.match(/^data:[^;]+;base64,([\s\S]*)$/); if(!m) continue
      imageBytes=Buffer.from(m[1],'base64')
    } else {
      const r=await fetch(ref.uri,{cache:'no-store'}); if(!r.ok) continue
      imageBytes=Buffer.from(await r.arrayBuffer())
    }
    referenceImages.push({image:{bytesBase64Encoded:imageBytes.toString('base64'),mimeType:ref.mimeType||'image/jpeg'},referenceType:'asset'})
  }

  const parameters:any = { aspectRatio, resolution, durationSeconds: duration }
  if (referenceImages.length) parameters.referenceImages = referenceImages

  const response = await fetch(`${BASE_URL}/models/${model}:predictLongRunning`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      instances: [{ prompt: input.prompt }],
      parameters,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error?.message || `Video provider request failed (${response.status}).`)
  }
  if (!data.name) throw new Error('Video provider did not return an operation name.')

  return {
    provider: 'google-veo',
    model,
    operationName: data.name,
    status: 'running',
    message: 'Video generation started. The provider is rendering the moving footage.',
  }
}

export async function getVideoGenerationStatus(operationName: string) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not configured.')

  const response = await fetch(`${BASE_URL}/${operationName}`, {
    headers: { 'x-goog-api-key': key },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || `Video status request failed (${response.status}).`)

  if (!data.done) return { status: 'running' as const, operationName }
  if (data.error) return { status: 'failed' as const, operationName, error: data.error.message || 'Video generation failed.' }

  const sample = data.response?.generateVideoResponse?.generatedSamples?.[0]
  const uri = sample?.video?.uri
  return {
    status: 'complete' as const,
    operationName,
    videoUri: uri,
    mimeType: sample?.video?.mimeType || 'video/mp4',
  }
}
