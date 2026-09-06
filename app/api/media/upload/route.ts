import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { randomUUID } from 'crypto'
import { insertMediaAsset } from '@/lib/db'

export async function POST(req:Request){
  try{
    const form=await req.formData(); const file=form.get('file'); const projectId=String(form.get('projectId')||'')
    if(!(file instanceof File)) return NextResponse.json({error:'file is required'},{status:400})
    if(!projectId) return NextResponse.json({error:'projectId is required'},{status:400})
    if(file.size>500*1024*1024) return NextResponse.json({error:'File exceeds 500 MB limit.'},{status:413})
    const id=`media-${randomUUID()}`
    const blob=await put(`films/${projectId}/${id}-${file.name}`,file,{access:'public',addRandomSuffix:false})
    const asset={id,projectId,kind:file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':'image',uri:blob.url,mimeType:file.type,sizeBytes:file.size,createdAt:new Date().toISOString()}
    await insertMediaAsset(asset)
    return NextResponse.json({asset})
  }catch(e:any){return NextResponse.json({error:e?.message||'Upload failed.'},{status:500})}
}
