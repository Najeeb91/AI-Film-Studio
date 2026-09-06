import { NextResponse } from 'next/server'
import { getVideoGenerationStatus } from '@/lib/video'
import { persistVideoForShot } from '@/lib/project-media'

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams
    const operation = q.get('operation')
    if (!operation) return NextResponse.json({ error: 'operation is required.' }, { status: 400 })
    const result:any = await getVideoGenerationStatus(operation)
    if (result.status==='complete' && result.videoUri && q.get('projectId') && q.get('shotId') && process.env.BLOB_READ_WRITE_TOKEN) {
      const asset=await persistVideoForShot(q.get('projectId')!,q.get('shotId')!,result.videoUri,result.mimeType||'video/mp4')
      result.videoUri=asset.uri; result.mediaAssetId=asset.id; result.durable=true
    }
    return NextResponse.json(result)
  } catch (error:any) { return NextResponse.json({ error:error?.message||'Unable to read video status.' }, { status:500 }) }
}
