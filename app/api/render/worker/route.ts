import { NextResponse } from 'next/server'
import { databaseEnabled,ensureDatabase,getRenderJob,updateRenderJob } from '@/lib/db'
import { requireInternalSecret } from '@/lib/security'
export async function GET(){return NextResponse.json({ok:true,workerConfigured:Boolean(process.env.RENDER_WORKER_URL),databaseEnabled})}
export async function POST(req:Request){
 const auth=requireInternalSecret(req,process.env.RENDER_WORKER_SECRET)
 if(!auth.ok) return NextResponse.json({error:'Unauthorized'},{status:401})
 const b=await req.json(); if(!b.jobId)return NextResponse.json({error:'jobId is required.'},{status:400})
 if(databaseEnabled){await ensureDatabase();const job=await getRenderJob(b.jobId);if(!job)return NextResponse.json({error:'Render job not found.'},{status:404});await updateRenderJob(b.jobId,{status:b.status,progress:b.progress,outputUri:b.outputUri,error:b.error});return NextResponse.json({ok:true})}
 return NextResponse.json({ok:true,mode:'filesystem-fallback'})
}
