import { NextResponse } from 'next/server'
export async function POST(req:Request){
  try{const b=await req.json(); if(!b.videoUri||!b.audioUri)return NextResponse.json({error:'videoUri and audioUri are required.'},{status:400})
    const url=process.env.LIPSYNC_API_URL; const key=process.env.LIPSYNC_API_KEY
    if(!url) return NextResponse.json({status:'unsupported',message:'No lip-sync provider is configured. V22 keeps the performance plan and dialogue audio ready for a provider adapter.'},{status:200})
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({videoUri:b.videoUri,audioUri:b.audioUri,characterId:b.characterId,projectId:b.projectId})})
    const d=await r.json().catch(()=>({})); if(!r.ok)return NextResponse.json({error:d?.error||`Lip-sync provider failed (${r.status}).`},{status:502});return NextResponse.json({status:'generating',provider:'external',job:d})
  }catch(e:any){return NextResponse.json({error:e?.message||'Lip-sync request failed.'},{status:500})}}
