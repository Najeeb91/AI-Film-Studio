import { DirectorPlan, QualityCheck, Shot } from './schemas'
import { extractQCFrames } from './visual-qc'

function sceneAt(plan:DirectorPlan,ci:number,si:number){return plan.chapters?.[ci]?.scenes?.[si]}
function shotAt(plan:DirectorPlan,ci:number,si:number){return sceneAt(plan,ci,si)?.shots?.[si === undefined ? 0 : 0]}
function adjacent(plan:DirectorPlan,ci:number,si:number,shi:number){
  const scene=sceneAt(plan,ci,si); if(!scene) return {prev:undefined,next:undefined}
  const prev=shi>0?scene.shots[shi-1]:(si>0?plan.chapters[ci].scenes[si-1]?.shots.at(-1):ci>0?plan.chapters[ci-1].scenes.at(-1)?.shots.at(-1):undefined)
  const next=shi<scene.shots.length-1?scene.shots[shi+1]:(si<plan.chapters[ci].scenes.length-1?plan.chapters[ci].scenes[si+1]?.shots[0]:ci<plan.chapters.length-1?plan.chapters[ci+1].scenes[0]?.shots[0]:undefined)
  return {prev,next}
}
function heuristic(plan:DirectorPlan,ci:number,si:number,shi:number,reason:string):QualityCheck{
 const shot=sceneAt(plan,ci,si)?.shots?.[shi]; const {prev}=adjacent(plan,ci,si,shi)
 const temporal=prev && shot ? (prev.continuityState?.locationName===shot.continuityState?.locationName?82:55):72
 const identity=prev&&shot&&JSON.stringify(prev.continuityState?.characterNames)===JSON.stringify(shot.continuityState?.characterNames)?90:60
 return {score:Math.round((temporal+identity)/2),continuityScore:temporal,motionScore:shot&&/(moving|tracking|pan|tilt|push|pull|walking|running|turning|movement)/i.test(`${shot.action} ${shot.camera}`)?88:62,visualRiskScore:reason?35:15,passed:false,issues:[reason||'Temporal sequence analysis requires multimodal review.'],checkedAt:new Date().toISOString(),analysisMode:'heuristic-fallback',reviewRequired:true,temporalConsistency:temporal,characterConsistency:identity,temporalNotes:[prev?`Compared against previous shot ${prev.id}.`:'No previous shot exists; establishing sequence baseline.']}
}
export async function runTemporalQC(input:{plan:DirectorPlan;chapterIndex:number;sceneIndex:number;shotIndex:number;videoUri?:string}):Promise<QualityCheck>{
 const {plan,chapterIndex:ci,sceneIndex:si,shotIndex:shi,videoUri}=input; const scene=sceneAt(plan,ci,si); const shot=scene?.shots?.[shi]; if(!scene||!shot) throw new Error('Shot not found.')
 const {prev}=adjacent(plan,ci,si,shi)
 if(!videoUri) return heuristic(plan,ci,si,shi,'No generated video is attached to the current shot.')
 if(!prev?.videoJob?.videoUri) return heuristic(plan,ci,si,shi,'No previous-shot video is available for temporal comparison.')
 let current, previous
 try{current=await extractQCFrames(videoUri,3); previous=await extractQCFrames(prev.videoJob.videoUri,3)}catch(e:any){return heuristic(plan,ci,si,shi,`Could not extract comparison frames: ${e?.message||'unknown error'}`)}
 const key=process.env.AI_GATEWAY_API_KEY; if(!key) return heuristic(plan,ci,si,shi,'AI visual analysis is not configured (AI_GATEWAY_API_KEY missing).')
 const prompt=`You are the temporal continuity supervisor for a professional AI film studio. Compare frames from the PREVIOUS shot and CURRENT shot. Judge continuity across the cut, not whether the shots are individually attractive. Return ONLY JSON with: score, continuityScore, temporalConsistency, characterConsistency, environmentConsistency, wardrobeDrift, identityDrift, environmentDrift, propDrift, transitionQuality, artifactSeverity, passed, issues, continuityBreaks, temporalNotes, recommendedAction. Scores 0-100 except drift values 0-100 where higher means MORE DRIFT. Penalize unexplained identity/face, wardrobe, props, location, architecture, lighting/time-of-day, scale/spatial orientation or physics changes. Allow intentional changes only when supported by the scene/story text. A cut can change camera angle and composition without being a continuity break.
PREVIOUS SHOT: ${prev.id}; action=${prev.action}; camera=${prev.camera}; prompt=${prev.prompt}; continuity=${JSON.stringify(prev.continuityState||{})}
CURRENT SHOT: ${shot.id}; action=${shot.action}; camera=${shot.camera}; prompt=${shot.prompt}; continuity=${JSON.stringify(shot.continuityState||{})}
SCENE: ${scene.title}; location=${scene.location}; time=${scene.timeOfDay}; purpose=${scene.purpose}
VISUAL STYLE: ${plan.visualStyle}`
 const content=[{type:'text',text:prompt},{type:'text',text:'PREVIOUS SHOT FRAMES'},...previous.map(f=>({type:'image_url',image_url:{url:f.data}})),{type:'text',text:'CURRENT SHOT FRAMES'},...current.map(f=>({type:'image_url',image_url:{url:f.data}}))]
 const r=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.TEMPORAL_QC_MODEL||process.env.VISUAL_QC_MODEL||'google/gemini-2.5-pro',messages:[{role:'user',content}],temperature:0.1,max_tokens:2200,response_format:{type:'json_object'}})})
 const d=await r.json().catch(()=>({})); if(!r.ok) return heuristic(plan,ci,si,shi,`Temporal visual model request failed (${r.status}).`)
 try{const x=JSON.parse(d.choices?.[0]?.message?.content||'{}'); return {score:Number(x.score)||0,continuityScore:Number(x.continuityScore)||0,motionScore:Number(x.motionScore)||0,visualRiskScore:Number(x.artifactSeverity)||0,passed:Boolean(x.passed),issues:Array.isArray(x.issues)?x.issues.slice(0,8).map(String):[],checkedAt:new Date().toISOString(),analysisMode:'multimodal',reviewRequired:x.recommendedAction==='review'||x.recommendedAction==='regenerate',characterConsistency:Number(x.characterConsistency)||0,environmentConsistency:Number(x.environmentConsistency)||0,temporalConsistency:Number(x.temporalConsistency)||0,artifactSeverity:Number(x.artifactSeverity)||0,recommendedAction:x.recommendedAction||'review',frameCount:current.length+previous.length,continuityBreaks:Array.isArray(x.continuityBreaks)?x.continuityBreaks.map(String):[],transitionQuality:Number(x.transitionQuality)||0,identityDrift:Number(x.identityDrift)||0,environmentDrift:Number(x.environmentDrift)||0,wardrobeDrift:Number(x.wardrobeDrift)||0,propDrift:Number(x.propDrift)||0,temporalNotes:Array.isArray(x.temporalNotes)?x.temporalNotes.map(String):[]}}
 catch{return heuristic(plan,ci,si,shi,'Temporal visual model returned invalid analysis JSON.')}
}
