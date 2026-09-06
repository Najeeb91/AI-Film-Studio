import {DirectorPlan, Shot, QualityCheck} from './schemas'

const words=(s:string)=>new Set((s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>3))
const overlap=(a:string,b:string)=>{const A=words(a),B=words(b); if(!A.size||!B.size)return 0; let n=0; for(const x of A)if(B.has(x))n++; return n/Math.max(1,Math.min(A.size,B.size))}

export function runShotQC(plan:DirectorPlan, chapterIndex:number, sceneIndex:number, shotIndex:number):QualityCheck {
 const shot=plan.chapters[chapterIndex].scenes[sceneIndex].shots[shotIndex]
 const scene=plan.chapters[chapterIndex].scenes[sceneIndex]
 const prev=shotIndex>0 ? scene.shots[shotIndex-1] : (sceneIndex>0 ? plan.chapters[chapterIndex].scenes[sceneIndex-1].shots.at(-1) : undefined)
 const characterContext=plan.characters.map(c=>`${c.name} ${c.description}`).join(' ')
 const worldContext=plan.locations.map(l=>`${l.name} ${l.description}`).join(' ')
 const context=`${scene.location} ${scene.timeOfDay} ${plan.visualStyle} ${characterContext} ${worldContext}`
 const continuityBase=prev ? overlap(`${prev.prompt} ${prev.action}`,`${shot.prompt} ${shot.action}`) : overlap(context,shot.prompt)
 const motion=/(moving|motion|tracking|push-in|pull-out|pan|tilt|walking|running|turning|camera move|movement|dynamic)/i.test(`${shot.prompt} ${shot.action} ${shot.camera}`)?92:58
 const riskTerms=/(still image|photo slideshow|static image|watermark|text overlay|logo|deformed|extra fingers|duplicate face)/i
 const visualRisk=riskTerms.test(shot.prompt)?25:8
 const continuity=Math.round(Math.min(100,45+continuityBase*55))
 const score=Math.round(continuity*.5+motion*.3+(100-visualRisk)*.2)
 const issues:string[]=[]
 if(continuity<70)issues.push('Weak continuity with the surrounding shot or established world.')
 if(motion<75)issues.push('Prompt does not strongly specify natural moving footage or camera motion.')
 if(visualRisk>20)issues.push('Prompt contains a visual-risk term that should be removed before generation.')
 if(!shot.prompt.toLowerCase().includes('actual') && !shot.prompt.toLowerCase().includes('moving'))issues.push('Explicitly reinforce that the output must be real moving video footage.')
 return {score,continuityScore:continuity,motionScore:motion,visualRiskScore:visualRisk,passed:score>=78&&continuity>=70&&motion>=75,issues,checkedAt:new Date().toISOString()}
}
