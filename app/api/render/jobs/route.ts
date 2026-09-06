import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { readFile,writeFile,mkdir } from 'fs/promises'
import path from 'path'
import { buildRenderManifest } from '@/lib/render'
import { databaseEnabled,ensureDatabase,getProject,createRenderJob,upsertProject } from '@/lib/db'
import { ensureProjectMediaDurable } from '@/lib/project-media'
const file=path.join(process.cwd(),'data','projects.json')
async function load(){try{return JSON.parse(await readFile(file,'utf8'))}catch{return []}}
async function save(x:any){await writeFile(file,JSON.stringify(x,null,2))}
export async function POST(req:Request){
  const body=await req.json();
  let project:any
  if(databaseEnabled){await ensureDatabase(); project=await getProject(body.projectId)} else {const projects=await load(); project=projects.find((x:any)=>x.id===body.projectId)}
  if(!project)return NextResponse.json({error:'Project not found.'},{status:404})
  try{
    if(process.env.REQUIRE_DURABLE_MEDIA==='1' && process.env.BLOB_READ_WRITE_TOKEN) await ensureProjectMediaDurable(body.projectId)
    const manifest=buildRenderManifest(body.projectId,project.plan,body.timeline||project.plan.timeline,body.outputOptions)
    const job={id:`render-${randomUUID()}`,projectId:body.projectId,status:'queued',progress:0,manifestVersion:manifest.version,manifest,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
    project.renderJob=job; project.status='Rendering'; project.progress=0
    if(databaseEnabled){await createRenderJob(job); await upsertProject(project.id,project)}
    else {const projects=await load(); const i=projects.findIndex((x:any)=>x.id===project.id); projects[i]=project; await save(projects)}
    if(process.env.RENDER_WORKER_URL){const workflowUrl=process.env.USE_RENDER_WORKFLOW==='1'?`${process.env.APP_URL||new URL(req.url).origin}/api/render/workflow`:null;if(workflowUrl){fetch(workflowUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:job.id,projectId:body.projectId,manifest})}).catch(()=>{})}else{fetch(process.env.RENDER_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.RENDER_WORKER_SECRET?{Authorization:`Bearer ${process.env.RENDER_WORKER_SECRET}`}:{})},body:JSON.stringify({jobId:job.id,projectId:body.projectId,manifest,callbackUrl:`${process.env.APP_URL||new URL(req.url).origin}/api/render/jobs/${job.id}/events`})}).catch(()=>{})}}
    else if(process.env.ENABLE_LOCAL_RENDER==='1') {const dir=path.join(process.cwd(),'data','render-jobs'); await mkdir(dir,{recursive:true}); const manifestPath=path.join(dir,`${job.id}.json`); await writeFile(manifestPath,JSON.stringify(manifest,null,2)); const {spawn}=await import('child_process'); const child=spawn(process.execPath,[path.join(process.cwd(),'scripts','render-job.mjs'),job.id,body.projectId,manifestPath],{detached:true,stdio:'ignore'}); child.unref()}
    return NextResponse.json({job,manifest})
  }catch(e:any){return NextResponse.json({error:e.message||'Could not start render.'},{status:400})}
}
