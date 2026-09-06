import {NextResponse} from 'next/server'

export async function POST(req:Request){
 const {jobId,projectId,manifest}=await req.json();
 if(!jobId||!projectId||!manifest)return NextResponse.json({error:'jobId and manifest are required.'},{status:400})
 const workerUrl=process.env.RENDER_WORKER_URL
 if(!workerUrl)return NextResponse.json({error:'RENDER_WORKER_URL is not configured.'},{status:503})
 const callbackUrl=`${process.env.APP_URL||new URL(req.url).origin}/api/render/jobs/${jobId}/events`
 const r=await fetch(`${workerUrl.replace(/\/$/,'')}/render`,{method:'POST',headers:{'content-type':'application/json',...(process.env.RENDER_WORKER_SECRET?{authorization:`Bearer ${process.env.RENDER_WORKER_SECRET}`}:{})},body:JSON.stringify({jobId,projectId,manifest,callbackUrl})})
 const data=await r.json().catch(()=>({error:'Render worker returned a non-JSON response.'}))
 if(!r.ok)return NextResponse.json({error:data?.error||`Render worker rejected job: ${r.status}`},{status:502})
 return NextResponse.json({runId:data?.runId||jobId,status:'started',worker:data})
}
