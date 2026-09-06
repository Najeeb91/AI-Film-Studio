import type { DirectorPlan, Shot, ShotPerformance, DialoguePerformance } from './schemas'

function sceneAt(plan:DirectorPlan,ci:number,si:number){ return plan.chapters?.[ci]?.scenes?.[si] }
function chars(plan:DirectorPlan,scene:any){
  const names=(scene?.purpose||'')+' '+(scene?.location||'')+' '+(scene?.title||'')
  return (plan.characters||[]).filter(c=>names.toLowerCase().includes(c.name.toLowerCase()))
}

export function buildPerformancePlan(plan:DirectorPlan,ci:number,si:number,shi:number):ShotPerformance{
  const scene=sceneAt(plan,ci,si); const shot=scene?.shots?.[shi]
  if(!scene||!shot) throw new Error('Shot not found.')
  const explicit=shot.prompt||''
  const dialogueChars=chars(plan,scene)
  const mode=/dialogue|speaks|says|conversation|interview|narrator|voice-over/i.test(explicit+' '+scene.purpose)?'dialogue':(/narrat|voice[- ]over/i.test(explicit)?'narration':'silent')
  const dialogue:DialoguePerformance[]=dialogueChars.slice(0,3).map((c,i)=>({
    id:`dialogue-${shot.id}-${i+1}`,characterId:c.id,characterName:c.name,text:'',emotion:'natural, story-appropriate',delivery:'human, conversational, believable pacing',
    emphasis:[],pauses:[],pronunciation:[],voice:c.voice,lipSyncStatus:'planned',createdAt:new Date().toISOString()
  }))
  return {mode,eyeLine:'Maintain motivated eye-lines and spatial relationship to other characters/camera.',blocking:shot.action||'Natural motivated movement; preserve continuity.',facialExpression:'Subtle, believable facial performance matching the emotional beat.',bodyLanguage:'Natural body language with physically plausible movement.',dialogue,performancePrompt:`Perform ${mode} naturally. Preserve character identity, wardrobe, blocking, eye-line and emotional continuity. Avoid exaggerated facial movement or robotic gestures. If speaking, synchronize mouth movement to the spoken words and maintain natural breathing, pauses and micro-expressions.`,generatedAt:new Date().toISOString(),version:1}
}

export function performancePrompt(plan:DirectorPlan,ci:number,si:number,shi:number,performance:ShotPerformance){
  const shot=plan.chapters[ci].scenes[si].shots[shi]
  const lines=(performance.dialogue||[]).filter(d=>d.text.trim()).map(d=>`${d.characterName}: ${d.text} [emotion: ${d.emotion}; delivery: ${d.delivery}]`).join('\n')
  return [shot.prompt, 'CHARACTER PERFORMANCE DIRECTIVE:', performance.performancePrompt, performance.eyeLine, performance.blocking, performance.facialExpression, performance.bodyLanguage, lines?'DIALOGUE:\n'+lines:'', 'Natural lip movement must match spoken dialogue when dialogue is present. Keep breathing, pauses, gaze and gestures human and physically plausible.'].filter(Boolean).join('\n\n')
}

export function flattenDialogue(plan:DirectorPlan){
  const out:DialoguePerformance[]=[]
  for(const ch of plan.chapters) for(const sc of ch.scenes) for(const sh of sc.shots) for(const d of sh.performance?.dialogue||[]) if(d.text.trim()) out.push(d)
  return out
}
