import {DirectorPlan, ProductionBlueprint} from './schemas'

function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n))}

const COVERAGE_TEMPLATES = [
  {type:'establishing',camera:'wide cinematic dolly',action:'slowly reveal the full environment and establish geography',label:'establishing'},
  {type:'wide',camera:'wide lateral tracking shot',action:'move through the environment with natural atmospheric motion',label:'environment'},
  {type:'medium',camera:'medium observational push-in',action:'follow the main subject or activity with restrained movement',label:'subject'},
  {type:'close-up',camera:'cinematic close-up with shallow depth of field',action:'subtle natural movement and a deliberate visual emphasis',label:'reaction'},
  {type:'detail',camera:'macro detail shot with slow rack focus',action:'animate an important object, texture or historical detail naturally',label:'detail'},
  {type:'overhead',camera:'high overhead cinematic view',action:'slow controlled movement revealing spatial relationships',label:'geography'},
  {type:'tracking',camera:'smooth forward tracking shot',action:'move alongside the subject or through the location with realistic motion',label:'journey'},
  {type:'low-angle',camera:'low-angle cinematic shot',action:'slowly reveal scale, architecture or a significant subject',label:'scale'},
  {type:'reaction',camera:'intimate medium close-up',action:'capture a believable human reaction or observational response',label:'human'},
  {type:'transition',camera:'slow atmospheric pan',action:'create a visual bridge into the next beat with natural environmental motion',label:'transition'}
]

function expandPlanForRuntime(plan:DirectorPlan):DirectorPlan {
  const targetSeconds=Math.max(60,plan.durationMinutes*60)
  const next={...plan,chapters:plan.chapters.map(c=>({...c,scenes:c.scenes.map(s=>({...s,shots:s.shots.map(sh=>({...sh}))}))}))}
  const allScenes=next.chapters.flatMap(c=>c.scenes)
  if(!allScenes.length)return next
  let currentSeconds=allScenes.flatMap(s=>s.shots).reduce((n,s)=>n+Number(s.duration||8),0)
  let cursor=0
  let guard=0
  while(currentSeconds<targetSeconds && guard<1000){
    const scene=allScenes[cursor%allScenes.length]
    const template=COVERAGE_TEMPLATES[(scene.shots.length+cursor)%COVERAGE_TEMPLATES.length]
    const seq=scene.shots.length+1
    const base=scene.shots[Math.max(0,scene.shots.length-1)]
    const shotId=`${scene.id}-coverage-${seq}`
    scene.shots.push({
      id:shotId,
      type:template.type,
      duration:8,
      camera:template.camera,
      action:template.action,
      prompt:`Cinematic documentary moving footage for ${scene.title}. ${scene.purpose}. Location: ${scene.location}. Time: ${scene.timeOfDay}. ${template.label} coverage: ${template.action}. Preserve the established visual style and continuity. Photorealistic, physically plausible motion, natural lighting, no slideshow or static image, no text overlays.`,
      status:'planned'
    })
    currentSeconds+=8
    cursor++
    guard++
    void base
  }
  return next
}

export function buildProductionBlueprint(plan:DirectorPlan):ProductionBlueprint {
  const scenes=plan.chapters.flatMap(c=>c.scenes)
  const shots=scenes.flatMap(s=>s.shots)
  const plannedSeconds=shots.reduce((n,s)=>n+Number(s.duration||8),0)
  const targetSeconds=plan.durationMinutes*60
  const targetShotCount=Math.max(1,Math.ceil(targetSeconds/8))
  const coverage=shots.length?Math.round(clamp((shots.length/Math.max(1,targetShotCount))*100,0,100)):0
  const pacing = plan.genre.toLowerCase().includes('document') ? 'Measured opening → investigative build → evidence/revelation → emotional conclusion' : 'Hook → escalation → turning point → climax → resolution'
  const scenePlans=scenes.map((s,idx)=>({
    sceneId:s.id,
    objective:s.purpose,
    emotionalBeat: idx===0?'orientation':idx%4===1?'curiosity':idx%4===2?'tension':'resolution',
    shotStrategy:s.shots.length>=7?'Coverage-rich: establish → environment → subject → action → reaction → detail → transition':'Coverage: establish → subject → reaction → detail',
    priority: idx<Math.max(1,Math.ceil(scenes.length*.12))?'hero':'standard' as 'hero'|'standard'
  }))
  const heroShots=Math.max(1,Math.round(shots.length*.10))
  return {
    version:2,
    targetRuntimeSeconds:targetSeconds,
    plannedRuntimeSeconds:plannedSeconds,
    coverageScore:coverage,
    pacingPlan:pacing,
    editorialIntent:'Prioritize story clarity, visual variety, continuity and natural human pacing. Every added shot must provide new narrative, geographic, emotional or evidentiary coverage; never pad with repetitive shots.',
    generationProfile: 'Premium cinematic coverage with continuity-aware moving footage',
    heroShotCount:heroShots,
    standardShotCount:Math.max(0,shots.length-heroShots),
    scenePlans,
    riskFlags:[
      ...(plannedSeconds<targetSeconds*.98?['Planned footage is slightly shorter than the requested runtime; add one final coverage pass.']:[]),
      ...(plannedSeconds>targetSeconds*1.12?['Planned footage has editorial safety coverage; the AI Editor should select the strongest takes.']:[]),
      ...(coverage<85?['Coverage remains below the premium target; add establishing, reaction and detail coverage where story permits.']:[])
    ],
    generatedAt:new Date().toISOString()
  }
}

export async function optimizeProductionPlan(plan:DirectorPlan):Promise<DirectorPlan>{
  // Re-planning must actually change the production plan, not merely score the
  // existing handful of shots. Expand it to runtime-capable moving footage first.
  const expanded=expandPlanForRuntime(plan)
  const fallback={...expanded,productionBlueprint:buildProductionBlueprint(expanded)}
  const key=process.env.AI_GATEWAY_API_KEY
  if(!key)return fallback
  const system=`You are the senior AI Film Director and production planner. Improve the supplied production strategy without changing its core story. Return ONLY JSON for productionBlueprint with: version,targetRuntimeSeconds,plannedRuntimeSeconds,coverageScore,pacingPlan,editorialIntent,generationProfile,heroShotCount,standardShotCount,scenePlans:[{sceneId,objective,emotionalBeat,shotStrategy,priority}],riskFlags,generatedAt. Do not reduce planned runtime below the supplied runtime-capable shot plan. Do not invent scene IDs. Favor purposeful coverage and limited hero shots.`
  try{
    const r=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.AI_DIRECTOR_MODEL||'openai/gpt-5.5',messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({requestedRuntimeMinutes:expanded.durationMinutes,genre:expanded.genre,title:expanded.title,visualStyle:expanded.visualStyle,chapters:expanded.chapters.map(c=>({id:c.id,title:c.title,scenes:c.scenes.map(s=>({id:s.id,title:s.title,purpose:s.purpose,shotCount:s.shots.length}))}))})}],response_format:{type:'json_object'},max_tokens:12000})})
    if(!r.ok)return fallback
    const d=await r.json(); const raw=d.choices?.[0]?.message?.content; if(!raw)return fallback
    const ai=JSON.parse(raw) as ProductionBlueprint
    const base=buildProductionBlueprint(expanded)
    // AI may refine editorial language, but runtime/coverage facts come from
    // the actual shot list so the UI can never report a 2-minute plan for a
    // 10-minute film after re-planning.
    const blueprint:ProductionBlueprint={
      ...base,
      ...ai,
      version:2,
      targetRuntimeSeconds:base.targetRuntimeSeconds,
      plannedRuntimeSeconds:base.plannedRuntimeSeconds,
      coverageScore:base.coverageScore,
      heroShotCount:base.heroShotCount,
      standardShotCount:base.standardShotCount,
      scenePlans:base.scenePlans.map((sp)=>{
        const aiSp=ai.scenePlans?.find(x=>x.sceneId===sp.sceneId)
        return aiSp?{...sp,...aiSp,sceneId:sp.sceneId,priority:sp.priority}:sp
      }),
      riskFlags:base.riskFlags,
      generatedAt:new Date().toISOString()
    }
    return {...expanded,productionBlueprint:blueprint}
  }catch{return fallback}
}
