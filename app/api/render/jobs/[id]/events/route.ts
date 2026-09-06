import {NextResponse} from 'next/server'
import {databaseEnabled,ensureDatabase,getRenderJob,updateRenderJob,upsertRenderChunk,getProject,upsertProject} from '@/lib/db'
import {readFile,writeFile} from 'fs/promises'
import path from 'path'
const file=path.join(process.cwd(),'data','projects.json')
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params
 if(process.env.RENDER_WORKER_SECRET && req.headers.get('authorization')!==`Bearer ${process.env.RENDER_WORKER_SECRET}`) return NextResponse.json({error:'Unauthorized'},{status:401})
 const body=await req.json()
 if(databaseEnabled){await ensureDatabase();const job=await getRenderJob(id);if(!job)return NextResponse.json({error:'Render job not found.'},{status:404});await updateRenderJob(id,body);if(Number.isInteger(body.chunkIndex)){await upsertRenderChunk({id:`${id}-chunk-${body.chunkIndex}`,renderJobId:id,chunkIndex:body.chunkIndex,startSeconds:Number(body.chunkStart||0),durationSeconds:Number(body.chunkDuration||0),status:body.chunkStatus||body.status,progress:Number(body.chunkProgress??body.progress??0),uri:body.chunkUri,error:body.error})}const project=await getProject(job.projectId);if(project){project.renderJob={...(project.renderJob||{}),...body,id};project.progress=body.progress??project.progress;project.status=body.status==='completed'?'Completed':body.status==='failed'?'Render failed':'Rendering';if(body.outputUri)project.renderJob.outputUri=body.outputUri;await upsertProject(job.projectId,project)}return NextResponse.json({ok:true})}
 const projects=JSON.parse(await readFile(file,'utf8'));const p=projects.find((x:any)=>x.renderJob?.id===id)
 if(!p)return NextResponse.json({error:'Render job not found.'},{status:404})
 p.renderJob={...p.renderJob,...body,updatedAt:new Date().toISOString()};p.progress=body.progress??p.renderJob.progress;p.status=body.status==='completed'?'Completed':body.status==='failed'?'Render failed':'Rendering';await writeFile(file,JSON.stringify(projects,null,2));return NextResponse.json({ok:true})
}
