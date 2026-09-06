import { NextResponse } from 'next/server'
import { generateNarration } from '@/lib/voice'
import { persistVoiceForProject } from '@/lib/project-media'

interface VoiceGenerateBody {
  text: string
  projectId?: string
  voice?: string
  language?: string
  style?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<VoiceGenerateBody>
    const text = String(body.text ?? '').trim()
    if (!text) return NextResponse.json({ error: 'Narration text is required.' }, { status: 400 })
    if (text.length > 12000) return NextResponse.json({ error: 'Narration is limited to 12,000 characters per generation.' }, { status: 400 })

    const result = await generateNarration({
      text,
      voice: body.voice ? String(body.voice) : undefined,
      language: body.language ? String(body.language) : undefined,
      style: body.style ? String(body.style) : undefined,
    })

    let response: Record<string, unknown> = { ...result }

    if (body.projectId && process.env.BLOB_READ_WRITE_TOKEN) {
      const asset = await persistVoiceForProject(String(body.projectId), result)
      if (asset) {
        response = {
          ...response,
          audioDataUrl: asset.uri,
          mediaAssetId: asset.id,
          durable: true,
        }
      }
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to generate narration.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
