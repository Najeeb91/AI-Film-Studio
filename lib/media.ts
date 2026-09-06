import { randomUUID } from 'crypto'
import { put } from '@vercel/blob'
import { insertMediaAsset } from './db'

export type GeneratedMediaKind = 'video'|'audio'|'image'|'subtitle'

export interface MediaAsset {
  id:string
  projectId:string
  kind:GeneratedMediaKind
  uri:string
  mimeType?:string
  sizeBytes:number
  metadata:Record<string,unknown>
}

export async function persistMedia(input:{projectId:string;kind:GeneratedMediaKind;uri:string;mimeType?:string;metadata?:Record<string,unknown>}): Promise<MediaAsset> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not configured.')
  if (!input.uri) throw new Error('Media URI is required.')
  let bytes: Buffer
  let contentType = input.mimeType
  if (input.uri.startsWith('data:')) {
    const m = input.uri.match(/^data:([^;]+);base64,([\s\S]*)$/)
    if (!m) throw new Error('Invalid data URI.')
    contentType ||= m[1]
    bytes = Buffer.from(m[2], 'base64')
  } else {
    const r = await fetch(input.uri, { cache:'no-store' })
    if (!r.ok) throw new Error(`Media download failed: ${r.status}`)
    const ab = await r.arrayBuffer()
    bytes = Buffer.from(ab)
    contentType ||= r.headers.get('content-type') || undefined
  }
  const id = `media-${randomUUID()}`
  const saved = await put(`films/${input.projectId}/media/${id}`, bytes, {
    access:'public', contentType:contentType || undefined, addRandomSuffix:false,
    token:process.env.BLOB_READ_WRITE_TOKEN,
  })
  const asset = {id, projectId:input.projectId, kind:input.kind, uri:saved.url, mimeType:contentType, sizeBytes:bytes.length, metadata:input.metadata || {}}
  await insertMediaAsset(asset)
  return asset
}
