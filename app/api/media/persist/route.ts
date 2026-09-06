import {NextResponse} from 'next/server'
import {randomUUID} from 'crypto'
import {put} from '@vercel/blob'
import {insertMediaAsset} from '@/lib/db'

export async function POST(req:Request){
  try{
    if(!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({error:'BLOB_READ_WRITE_TOKEN is not configured.'},{status:503})
    const b=await req.json(); const uri=String(b.uri||''); const projectId=String(b.projectId||''); const kind=String(b.kind||'video')
    if(!uri||!projectId) return NextResponse.json({error:'uri and projectId are required.'},{status:400})
    if(uri.startsWith('data:')){
      const m=uri.match(/^data:([^;]+);base64,([\s\S]*)$/); if(!m) throw new Error('Invalid data URI')
      const saved=await put(`films/${projectId}/media/${randomUUID()}`,Buffer.from(m[2],'base64'),{access:'public',contentType:m[1],addRandomSuffix:false})
      const asset={id:`media-${randomUUID()}`,projectId,kind,uri:saved.url,mimeType:m[1],sizeBytes:Buffer.from(m[2],'base64').length,metadata:{source:'data-uri'}}
      await insertMediaAsset(asset); return NextResponse.json({asset})
    }
    if(!/^https?:\/\//i.test(uri)) return NextResponse.json({error:'Only HTTP(S) or data URIs can be persisted.'},{status:400})
    const r=await fetch(uri); if(!r.ok) throw new Error(`Media download failed: ${r.status}`)
    const blob=await r.blob(); const saved=await put(`films/${projectId}/media/${randomUUID()}`,blob,{access:'public',contentType:blob.type||undefined,addRandomSuffix:false})
    const asset={id:`media-${randomUUID()}`,projectId,kind,uri:saved.url,mimeType:blob.type,sizeBytes:blob.size,metadata:{source:'remote-url'}}
    await insertMediaAsset(asset); return NextResponse.json({asset})
  }catch(e:any){return NextResponse.json({error:e?.message||'Media persistence failed.'},{status:500})}
}
