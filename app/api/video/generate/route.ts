import { NextResponse } from 'next/server'
import { startVideoGeneration } from '@/lib/video'
import { enforceContinuityPrompt } from '@/lib/continuity'
import { getProject } from '@/lib/db'
import { performancePrompt } from '@/lib/performance'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    let prompt = String(body.prompt || '').trim()
    if (!prompt) return NextResponse.json({ error: 'Shot prompt is required.' }, { status: 400 })

    let continuityState:any = undefined
    let referenceImages:any[] = []
    if (body.plan && body.chapterIndex !== undefined && body.sceneIndex !== undefined && body.shotIndex !== undefined) {
      const ci=Number(body.chapterIndex),si=Number(body.sceneIndex),shi=Number(body.shotIndex)
      const enforced = enforceContinuityPrompt(body.plan, ci, si, shi, prompt)
      prompt = enforced.prompt
      continuityState = enforced.state
      const shot=body.plan.chapters?.[ci]?.scenes?.[si]?.shots?.[shi]
      if(shot?.performance) prompt = performancePrompt(body.plan,ci,si,shi,shot.performance)
      const manifest=shot?.referenceManifest?.references||[]
      const refs=(body.plan.references||[])
      for(const m of manifest.filter((x:any)=>x.included!==false).sort((a:any,b:any)=>(a.priority??99)-(b.priority??99))) {
        const r=refs.find((x:any)=>x.id===m.referenceId)
        if(r?.uri) referenceImages.push({uri:r.uri,mimeType:r.mimeType,label:r.label,referenceId:r.id,priority:m.priority,role:m.role})
      }
      // Backward compatibility: if no V18 manifest exists, use active character identity references.
      if(!referenceImages.length){
        const ids=enforced.state.characterIds||[]
        const chars=(body.plan.characters||[]).filter((c:any)=>ids.includes(c.id))
        for(const c of chars) for(const ref of (c.referenceImages||[])) if(ref.active!==false) referenceImages.push({uri:ref.uri,mimeType:ref.mimeType,label:`${c.name} reference`,referenceId:ref.id,priority:0,role:'identity'})
      }
      referenceImages=referenceImages.sort((a,b)=>(a.priority??99)-(b.priority??99)).slice(0,3)
    }
    const numericDuration = Number(body.duration)
    let duration: 4 | 6 | 8 | undefined
    if (numericDuration === 4) duration = 4
    else if (numericDuration === 6) duration = 6
    else if (numericDuration === 8) duration = 8

    const result = await startVideoGeneration({
      prompt,
      aspectRatio: body.aspectRatio === '9:16' ? '9:16' : '16:9',
      resolution: ['720p', '1080p', '4k'].includes(body.resolution) ? body.resolution : '1080p',
      duration,
      referenceImages,
    })
    return NextResponse.json({...result, continuityState, referenceImagesUsed:referenceImages.length, referenceIdsUsed:referenceImages.map((r:any)=>r.referenceId).filter(Boolean)}, { status: 202 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to start video generation.' }, { status: 500 })
  }
}
