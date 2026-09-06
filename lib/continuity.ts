import { DirectorPlan, Shot, ContinuityState } from './schemas'

function findScene(plan:DirectorPlan, ci:number, si:number){ return plan.chapters?.[ci]?.scenes?.[si] }
function previousShot(plan:DirectorPlan, ci:number, si:number, shi:number): {shot?:Shot; sceneTitle?:string} {
  const scene=findScene(plan,ci,si); if(!scene) return {}
  if(shi>0) return {shot:scene.shots[shi-1],sceneTitle:scene.title}
  if(si>0){const prev=plan.chapters[ci].scenes[si-1];return {shot:prev.shots[prev.shots.length-1],sceneTitle:prev.title}}
  if(ci>0){const prevCh=plan.chapters[ci-1];const prev=prevCh.scenes[prevCh.scenes.length-1];return {shot:prev.shots[prev.shots.length-1],sceneTitle:prev.title}}
  return {}
}

function characterTokens(plan:DirectorPlan, scene:any){
  const names=(plan.characters||[]).map(c=>c.name).filter(Boolean)
  return {ids:(plan.characters||[]).map(c=>c.id),names,wardrobe:(plan.characters||[]).flatMap(c=>{
    const d=String(c.description||''); const m=d.match(/(?:wearing|dressed in|clothing)[:\s]+([^.;]+)/i); return m?[`${c.name}: ${m[1].trim()}`]:[]
  })}
}

export function buildContinuityState(plan:DirectorPlan, ci:number, si:number, shi:number):ContinuityState {
  const scene=findScene(plan,ci,si); if(!scene) throw new Error('Scene not found.')
  const shot=scene.shots?.[shi]; if(!shot) throw new Error('Shot not found.')
  const prev=previousShot(plan,ci,si,shi)
  const totalShots=plan.chapters.reduce((n,c)=>n+c.scenes.reduce((m,x)=>m+x.shots.length,0),0)
  const sequenceIndex=plan.chapters.slice(0,ci).reduce((n,c)=>n+c.scenes.reduce((m,x)=>m+x.shots.length,0),0)+plan.chapters[ci].scenes.slice(0,si).reduce((n,x)=>n+x.shots.length,0)+shi+1
  const chars=characterTokens(plan,scene)
  const location=plan.locations?.find(l=>l.name===scene.location) || plan.locations?.[0]
  const props=[...(String(scene.purpose||'').match(/\b(?:sword|book|lamp|vehicle|horse|phone|camera|door|table|weapon|artifact|tool)\b/gi)||[])].map(x=>x.toLowerCase()).filter((x,i,a)=>a.indexOf(x)===i)
  const continuityPrompt=[
    'CONTINUITY LOCK:',
    chars.names.length?`Characters present: ${chars.names.join(', ')}.`:'Preserve all established characters exactly as defined.',
    chars.wardrobe.length?`Wardrobe locks: ${chars.wardrobe.join(' | ')}.`:'Preserve established wardrobe, hair and physical appearance.',
    location?`Location lock: ${location.name} — ${location.description}.`:`Location lock: ${scene.location}.`,
    `Time/lighting lock: ${scene.timeOfDay}.`,
    plan.visualStyle?`Visual style lock: ${plan.visualStyle}.`:'Preserve the established visual style.',
    props.length?`Important recurring props: ${props.join(', ')}.`:'Preserve important props from prior shots.',
    prev.shot?`Previous shot continuity: ${prev.shot.id}; maintain identity, wardrobe, environment, lighting and spatial logic from it.`:'This is the first shot; establish canonical visual identity for later shots.',
    chars.names.length?`Character reference images are authoritative for identity; use the available references for these characters.`:'',
    shot?.referenceManifest?.references?.filter((r:any)=>r.included!==false).length?`Matched visual references: ${shot.referenceManifest.references.filter((r:any)=>r.included!==false).map((r:any)=>r.referenceId).join(', ')}.`:'',
    'Do not change character identity, age, clothing, location architecture, time progression or recurring props without an explicit story instruction.',
  ].join(' ')
  return {characterIds:chars.ids,characterNames:chars.names,wardrobe:chars.wardrobe,props,locationId:location?.id,locationName:location?.name,timeOfDay:scene.timeOfDay,visualStyle:plan.visualStyle,sceneProgress:{sequenceIndex,totalShots,previousShotId:prev.shot?.id,nextShotId:scene.shots[shi+1]?.id,expectedTimeProgression:`${scene.timeOfDay} within scene; preserve story-driven progression only.`},lockedElements:{characterIds:chars.ids,locationId:location?.id,wardrobe:chars.wardrobe,props,references:shot?.referenceManifest?.references?.filter((r:any)=>r.included!==false).map((r:any)=>r.referenceId)||[],visualStyle:plan.visualStyle},matchedReferenceIds:shot?.referenceManifest?.references?.filter((r:any)=>r.included!==false).map((r:any)=>r.referenceId)||[],previousShotId:prev.shot?.id,previousShotSummary:prev.shot?.action,continuityPrompt,version:2,generatedAt:new Date().toISOString()}
}

export function enforceContinuityPrompt(plan:DirectorPlan, ci:number, si:number, shi:number, prompt:string){
  const state=buildContinuityState(plan,ci,si,shi)
  const clean=prompt.replace(/CONTINUITY LOCK:[\s\S]*$/i,'').trim()
  return {prompt:[clean,state.continuityPrompt,'Generate continuous, natural moving footage; no still-image or slideshow behavior.'].filter(Boolean).join('\n\n'),state}
}

export function continuityReport(plan:DirectorPlan, ci:number, si:number, shi:number){
  const scene=findScene(plan,ci,si); const shot=scene?.shots?.[shi]; if(!scene||!shot) throw new Error('Shot not found.')
  const expected=buildContinuityState(plan,ci,si,shi)
  const issues:string[]=[]
  if(shot.continuityState){
    if(shot.continuityState.locationName!==expected.locationName) issues.push('Location state changed from the established scene location.')
    if(JSON.stringify(shot.continuityState.characterNames)!==JSON.stringify(expected.characterNames)) issues.push('Character set changed.')
    if(JSON.stringify(shot.continuityState.wardrobe)!==JSON.stringify(expected.wardrobe)) issues.push('Wardrobe lock changed.')
  }
  return {expected,issues,passed:issues.length===0}
}
