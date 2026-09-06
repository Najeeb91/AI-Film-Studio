import { experimental_generateSpeech as generateSpeech } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import type { VoiceGeneration } from './schemas'

export type VoiceGenerationRequest = {
  text: string
  voice?: string
  language?: string
  style?: string
}

export async function generateNarration(input: VoiceGenerationRequest): Promise<VoiceGeneration> {
  const key = process.env.AI_GATEWAY_API_KEY
  if (!key) throw new Error('AI_GATEWAY_API_KEY is not configured. Add it to enable natural voice generation.')

  const text = input.text.trim()
  if (!text) throw new Error('Narration text is required.')

  const voice = input.voice || process.env.VOICE_ID || '933563129e564b19a115bedd57b7406a'
  const style = input.style || 'natural documentary narration, warm human delivery, clear pronunciation, measured pacing'
  const directedText = `[${style}] ${text}`

  const result = await generateSpeech({
    model: gateway.speechModel(process.env.VOICE_MODEL || 'fish-audio/s2.1-pro'),
    text: directedText,
    voice,
  })

  const bytes = result.audio.uint8Array
  const base64 = Buffer.from(bytes).toString('base64')
  return {
    provider: 'fish-audio',
    model: process.env.VOICE_MODEL || 'fish-audio/s2.1-pro',
    voice,
    mimeType: 'audio/mpeg',
    audioDataUrl: `data:audio/mpeg;base64,${base64}`,
    characterCount: text.length,
    generatedAt: new Date().toISOString(),
  }
}
