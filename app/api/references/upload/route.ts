import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { randomUUID } from 'crypto'
import { insertMediaAsset, databaseEnabled, ensureDatabase, getProject, upsertProject } from '@/lib/db'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import type { ReferenceType } from '@/lib/schemas'
async function load(){try{return JSON.parse(await readFile(path.join(process.cwd(),'data','projects.json'),'utf8'))}catch{return []}}
async function save(x:any){await writeFile(path.join(process.cwd(),'data','projects.json'),JSON.stringify(x,null,2))}
const types=['character','location','prop','costume','architecture','artifact','visual']
export async function POST(req:Request){try{
 const form=await req.formData(); const file=form.get('file'); const projectId=String(form.get('projectId')||''); const type=String(form.get('type')||'visual') as ReferenceType
 const characterId=String(form.get('characterId')||'')||undefined; const locationId=String(form.get('locationId')||'')||undefined
 const label=String(form.get('label')||'') || (file instanceof File?file.name:'Reference'); const description=String(form.get('description')||'')||undefined
 const tags=String(form.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean)
 if(!(file instanceof File))return NextResponse.json({error:'file is required.'},{status:400})
 if(!projectId)return NextResponse.json({error:'projectId is required.'},{status:400})
 if(!types.includes(type))return NextResponse.json({error:'Invalid reference type.'},{status:400})
 if(!file.type.startsWith('image/'))return NextResponse.json({error:'Only image reference files are supported.'},{status:400})
 if(file.size>25*1024*1024)return NextResponse.json({error:'Reference image exceeds 25 MB.'},{status:413})
 if(!process.env.BLOB_READ_WRITE_TOKEN)return NextResponse.json({error:'BLOB_READ_WRITE_TOKEN is not configured.'},{status:500})
 const id=`ref-${randomUUID()}`; const blob=await put(`films/${projectId}/references/${id}-${file.name}`,file,{access:'public',addRandomSuffix:false})
 const asset={id:`media-${id}`,projectId,kind:'image',uri:blob.url,mimeType:file.type,sizeBytes:file.size,metadata:{role:`${type}-reference`,referenceType:type,characterId,locationId,filename:file.name},createdAt:new Date().toISOString()}; await insertMediaAsset(asset)
 const ref={id,projectId,type,label,uri:asset.uri,mimeType:file.type,description,tags,active:true,createdAt:new Date().toISOString(),characterId,locationId}
 let p:any;if(databaseEnabled){await ensureDatabase();p=await getProject(projectId);if(!p)return NextResponse.json({error:'Project not found.'},{status:404})}else{const ps=await load();const i=ps.findIndex((x:any)=>x.id===projectId);if(i<0)return NextResponse.json({error:'Project not found.'},{status:404});p=ps[i]}
 p.plan.references=[...(p.plan.references||[]),ref]
 // Preserve the V17 character reference contract so existing generation remains compatible.
 if(type==='character'&&characterId){const c=(p.plan.characters||[]).find((x:any)=>x.id===characterId);if(c){c.referenceImages=[...(c.referenceImages||[]),{id,mediaAssetId:asset.id,uri:asset.uri,mimeType:file.type,label,createdAt:ref.createdAt,active:true}]}}
 if(databaseEnabled)await upsertProject(projectId,{...p,updatedAt:new Date().toISOString()});else{const ps=await load();const i=ps.findIndex((x:any)=>x.id===projectId);ps[i]=p;await save(ps)}
 return NextResponse.json({reference:ref,asset})
}catch(e:any){return NextResponse.json({error:e?.message||'Reference upload failed.'},{status:500})}}
