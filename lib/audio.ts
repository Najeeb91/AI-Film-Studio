export type AudioAsset = {
  id: string
  kind: 'music' | 'sfx'
  provider: 'elevenlabs'
  model: string
  prompt: string
  durationSeconds: number
  mimeType: string
  audioDataUrl: string
  generatedAt: string
  volume: number
  startSeconds: number
  fadeInSeconds: number
  fadeOutSeconds: number
  duckUnderVoice: boolean
}

async function eleven(pathname: string, body: unknown) {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY is not configured. Add it to enable music and sound-effect generation.')
  const r = await fetch(`https://api.elevenlabs.io${pathname}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`ElevenLabs audio generation failed (${r.status}). ${text.slice(0, 300)}`)
  }
  return r
}

export async function generateMusic(prompt: string, durationSeconds: number) {
  const seconds = Math.min(600, Math.max(3, Math.round(durationSeconds)))
  const r = await eleven('/v1/music', {
    prompt: prompt.slice(0, 4100),
    music_length_ms: seconds * 1000,
    model_id: process.env.MUSIC_MODEL || 'music_v2',
    force_instrumental: true,
    output_format: 'mp3_48000_192',
  })
  const bytes = new Uint8Array(await r.arrayBuffer())
  return makeAsset('music', process.env.MUSIC_MODEL || 'music_v2', prompt, seconds, bytes)
}

export async function generateSfx(prompt: string, durationSeconds?: number) {
  const seconds = durationSeconds ? Math.min(30, Math.max(0.5, Number(durationSeconds))) : undefined
  const r = await eleven('/v1/sound-generation', {
    text: prompt.slice(0, 450),
    model_id: process.env.SFX_MODEL || 'eleven_text_to_sound_v2',
    duration_seconds: seconds,
    prompt_influence: 0.65,
    output_format: 'mp3_44100_128',
  })
  const bytes = new Uint8Array(await r.arrayBuffer())
  return makeAsset('sfx', process.env.SFX_MODEL || 'eleven_text_to_sound_v2', prompt, seconds || 5, bytes)
}

function makeAsset(kind: 'music' | 'sfx', model: string, prompt: string, durationSeconds: number, bytes: Uint8Array): AudioAsset {
  const base64 = Buffer.from(bytes).toString('base64')
  return {
    id: crypto.randomUUID(), kind, provider: 'elevenlabs', model, prompt,
    durationSeconds, mimeType: 'audio/mpeg', audioDataUrl: `data:audio/mpeg;base64,${base64}`,
    generatedAt: new Date().toISOString(), volume: kind === 'music' ? 0.28 : 0.65,
    startSeconds: 0, fadeInSeconds: kind === 'music' ? 2 : 0.05, fadeOutSeconds: kind === 'music' ? 3 : 0.1,
    duckUnderVoice: kind === 'music',
  }
}
