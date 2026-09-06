import { DirectorPlan, ProjectReference, ReferenceManifest, Shot, ShotReference } from './schemas'

const TYPE_TERMS:Record<string,string[]>={
  location:['location','environment','city','street','building','landscape','interior','exterior','palace','fort','desert','village','room','temple'],
  architecture:['architecture','building','structure','monument','palace','fort','temple','ruins','gate','wall','street'],
  prop:['prop','object','sword','book','lamp','horse','vehicle','phone','camera','door','table','tool','artifact','weapon','map'],
  costume:['costume','clothing','dress','robe','uniform','armor','outfit','garment','turban','hat'],
  artifact:['artifact','archaeology','relic','pottery','coin','inscription','statue','ancient object','historical object'],
  visual:['style','lighting','palette','cinematic','visual','reference','look'],
  character:['character','person','face','identity','actor']
}
function hay(r:ProjectReference){return [r.label,r.description,...(r.tags||[])].filter(Boolean).join(' ').toLowerCase()}
function textFor(plan:DirectorPlan,ci:number,si:number,shi:number){
 const scene=plan.chapters?.[ci]?.scenes?.[si]; const shot=scene?.shots?.[shi]
 return [scene?.title,scene?.purpose,scene?.location,scene?.timeOfDay,shot?.type,shot?.camera,shot?.action,shot?.prompt,plan.visualStyle].filter(Boolean).join(' ').toLowerCase()
}
function score(r:ProjectReference, text:string, plan:DirectorPlan, ci:number,si:number,shi:number){
 let n=0; const h=hay(r)
 if(!r.active) return -999
 if(r.shotIds?.includes(plan.chapters[ci].scenes[si].shots[shi].id)) n+=100
 if(r.sceneIds?.includes(plan.chapters[ci].scenes[si].id)) n+=80
 if(r.characterId && (plan.chapters[ci].scenes[si].shots[shi].continuityState?.characterIds||[]).includes(r.characterId)) n+=90
 if(r.locationId){const loc=plan.locations?.find(x=>x.id===r.locationId);if(loc?.name===plan.chapters[ci].scenes[si].location)n+=85}
 const terms=TYPE_TERMS[r.type]||[]; if(terms.some(x=>text.includes(x))) n+=18
 for(const token of h.split(/[^a-z0-9]+/).filter(x=>x.length>3)){if(text.includes(token))n+=3}
 if(r.type==='character') n+=2
 return n
}

export function matchReferences(plan:DirectorPlan,ci:number,si:number,shi:number,max=3):ReferenceManifest{
 const scene=plan.chapters?.[ci]?.scenes?.[si]; const shot=scene?.shots?.[shi]; if(!scene||!shot) throw new Error('Shot not found.')
 const refs=(plan.references||[]).filter(r=>r.active!==false)
 const text=textFor(plan,ci,si,shi)
 const ranked=refs.map(r=>({r,s:score(r,text,plan,ci,si,shi)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s)
 const selected:ShotReference[]=[]
 const add=(r:ProjectReference,reason:string,priority:number,source:'auto'|'manual'='auto')=>{if(selected.some(x=>x.referenceId===r.id))return;selected.push({referenceId:r.id,role:r.type==='character'?'identity':r.type,priority,reason,included:true,source})}
 // Explicit character references remain the strongest identity anchors and stay backward compatible.
 for(const c of plan.characters||[]) for(const cr of c.referenceImages||[]) if(cr.active!==false && (shot.continuityState?.characterIds||[]).includes(c.id)) {
   const projectRef=refs.find(r=>r.id===cr.id) || refs.find(r=>r.uri===cr.uri)
   if(projectRef) add(projectRef,`Character identity anchor for ${c.name}.`,0)
 }
 for(const x of ranked) { if(selected.length>=max) break; add(x.r,`Matched to shot context: ${x.r.type} reference is relevant to the scene, shot action or established world.`,selected.length+1) }
 return {references:selected,maxProviderReferences:max,generatedAt:new Date().toISOString(),version:1}
}
