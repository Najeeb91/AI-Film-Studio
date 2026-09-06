import { NextResponse } from 'next/server'
import { buildContinuityState, continuityReport, enforceContinuityPrompt } from '@/lib/continuity'
export async function POST(req:Request){
  try{
    const b=await req.json(); if(!b.plan||b.chapterIndex===undefined||b.sceneIndex===undefined||b.shotIndex===undefined) return NextResponse.json({error:'Plan and shot coordinates are required.'},{status:400})
    const ci=Number(b.chapterIndex),si=Number(b.sceneIndex),shi=Number(b.shotIndex)
    if(b.action==='report') return NextResponse.json(continuityReport(b.plan,ci,si,shi))
    const state=buildContinuityState(b.plan,ci,si,shi)
    if(b.action==='enforce') { const r=enforceContinuityPrompt(b.plan,ci,si,shi,String(b.prompt||b.plan.chapters[ci].scenes[si].shots[shi].prompt||'')); return NextResponse.json(r) }
    return NextResponse.json({continuityState:state})
  }catch(e:any){return NextResponse.json({error:e?.message||'Continuity operation failed.'},{status:500})}
}
