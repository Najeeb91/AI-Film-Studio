import { NextResponse } from 'next/server'
import { startVideoGeneration } from '@/lib/video'

const n=(v:any,d=0)=>Math.max(0,Math.min(100,Number(v)||d))
export async function POST(req:Request){
  try{
    const body=await req.json(); const plan=body.plan
    const ci=Number(body.chapterIndex),si=Number(body.sceneIndex),shi=Number(body.shotIndex)
    const shot=plan?.chapters?.[ci]?.scenes?.[si]?.shots?.[shi]; const scene=plan?.chapters?.[ci]?.scenes?.[si]
    if(!shot||!scene) return NextResponse.json({error:'Valid project and shot coordinates are required.'},{status:400})
    if(!shot.qualityCheck) return NextResponse.json({error:'Run visual QC before regeneration.'},{status:400})
    const attempts=Number(shot.regeneration?.attempts||0), maxAttempts=Math.max(1,Math.min(5,Number(body.maxAttempts||3)))
    if(attempts>=maxAttempts) return NextResponse.json({error:`Maximum regeneration attempts (${maxAttempts}) reached. Manual review required.`},{status:409})
    const key=process.env.AI_GATEWAY_API_KEY; if(!key) return NextResponse.json({error:'AI_GATEWAY_API_KEY is required for AI Director shot repair.'},{status:503})
    const q=shot.qualityCheck
    const instruction=`You are the senior AI Director responsible for repairing one failed generated-video shot. Rewrite the prompt to fix the observed visual problems while preserving story intent, character identity, location, period, camera intent, motion and visual style. Do not make it a still image. Require continuous natural physical motion. Do not mention QC, scores, models, or regeneration. Return ONLY JSON: {"revisedPrompt":"...","diagnosis":["..."],"repairChanges":["..."]}.
SHOT: ${JSON.stringify({type:shot.type,duration:shot.duration,camera:shot.camera,action:shot.action,prompt:shot.prompt})}
SCENE: ${JSON.stringify({title:scene.title,purpose:scene.purpose,location:scene.location,timeOfDay:scene.timeOfDay})}
VISUAL STYLE: ${plan.visualStyle}
CHARACTERS: ${JSON.stringify(plan.characters)}
LOCATIONS: ${JSON.stringify(plan.locations)}
FAILED ANALYSIS: ${JSON.stringify({score:n(q.score),continuity:n(q.continuityScore),motion:n(q.motionScore),risk:n(q.visualRiskScore),issues:q.issues,characterConsistency:q.characterConsistency,environmentConsistency:q.environmentConsistency,temporalConsistency:q.temporalConsistency,realism:q.realism,composition:q.composition,motionQuality:q.motionQuality,artifactSeverity:q.artifactSeverity})}`
    const r=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.DIRECTOR_MODEL||'openai/gpt-5.5',messages:[{role:'user',content:instruction}],temperature:.2,max_tokens:1600,response_format:{type:'json_object'}})})
    const d=await r.json().catch(()=>({})); if(!r.ok) return NextResponse.json({error:d?.error?.message||`Director repair failed (${r.status}).`},{status:502})
    const x=JSON.parse(d.choices?.[0]?.message?.content||'{}'); const revisedPrompt=String(x.revisedPrompt||'').trim(); if(!revisedPrompt) throw new Error('No revised prompt returned.')
    const generation=await startVideoGeneration({prompt:revisedPrompt,aspectRatio:body.aspectRatio==='9:16'?'9:16':'16:9',resolution:['720p','1080p','4k'].includes(body.resolution)?body.resolution:'1080p',duration:[4,6,8].includes(Number(shot.duration))?Number(shot.duration) as 4|6|8:8})
    return NextResponse.json({generation,revisedPrompt,diagnosis:Array.isArray(x.diagnosis)?x.diagnosis.slice(0,8):[],repairChanges:Array.isArray(x.repairChanges)?x.repairChanges.slice(0,8):[],attempt:attempts+1},{status:202})
  }catch(e:any){return NextResponse.json({error:e?.message||'Automatic shot regeneration failed.'},{status:500})}
}
