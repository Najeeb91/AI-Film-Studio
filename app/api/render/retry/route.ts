import {NextResponse} from 'next/server'
import {randomUUID} from 'crypto'
import {readFile,writeFile,mkdir} from 'fs/promises'
import path from 'path'
import {ensureProjectMediaDurable} from '@/lib/project-media'
import {buildRenderManifest} from '@/lib/render'
import {databaseEnabled,ensureDatabase,getProject,createRenderJob,upsertProject} from '@/lib/db'
const file=path.join(process.cwd(),'data','projects.json')
export async function POST(req:Request){
 const body=await req.json(); const {projectId,timeline}=body;let project:any
 if(databaseEnabled){await ensureDatabase();project=await getProject(projectId)}else{project=JSON.parse(await readFile(file,'utf8')).find((x:any)=>x.id===projectId)}
 if(!project)return NextResponse.json({error:'Project not found.'},{status:404})
 try{if(process.env.REQUIRE_DURABLE_MEDIA==='1' && process.env.BLOB_READ_WRITE_TOKEN) await ensureProjectMediaDurable(projectId);const manifest=buildRenderManifest(projectId,project.plan,timeline||project.plan.timeline,body.outputOptions);const job={id:`render-${randomUUID()}`,projectId,status:'queued',progress:0,manifestVersion:manifest.version,manifest,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};project.renderJob=job;project.status='Rendering';project.progress=0;if(databaseEnabled){await createRenderJob(job);await upsertProject(project.id,project)}else{const ps=JSON.parse(await readFile(file,'utf8'));ps[ps.findIndex((x:any)=>x.id===project.id)]=project;await writeFile(file,JSON.stringify(ps,null,2))}if(process.env.RENDER_WORKER_URL){fetch(process.env.RENDER_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.RENDER_WORKER_SECRET?{Authorization:`Bearer ${process.env.RENDER_WORKER_SECRET}`}:{})},body:JSON.stringify({jobId:job.id,projectId,manifest,callbackUrl:`${process.env.APP_URL||''}/api/render/jobs/${job.id}/events`})}).catch(()=>{})}else if(process.env.ENABLE_LOCAL_RENDER==='1'){const dir=path.join(process.cwd(),'data','render-jobs');await mkdir(dir,{recursive:true});const manifestPath=path.join(dir,`${job.id}.json`);await writeFile(manifestPath,JSON.stringify(manifest,null,2));const {spawn}=await import('child_process');const child=spawn(process.execPath,[path.join(process.cwd(),'scripts','render-job.mjs'),job.id,projectId,manifestPath],{detached:true,stdio:'ignore'});child.unref()}return NextResponse.json({job,manifest})}catch(e:any){return NextResponse.json({error:e.message||'Could not retry render.'},{status:400})}
}
