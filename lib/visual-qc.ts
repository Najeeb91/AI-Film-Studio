import { spawn } from 'child_process'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { QualityCheck, DirectorPlan } from './schemas'

function run(cmd:string,args:string[]):Promise<void>{return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(err||`${cmd} exited ${c}`)))})}
async function fetchBytes(uri:string){const r=await fetch(uri);if(!r.ok)throw new Error(`Unable to fetch media (${r.status})`);return Buffer.from(await r.arrayBuffer())}

export async function extractQCFrames(videoUri:string, count=4){
 const dir=await mkdtemp(path.join(os.tmpdir(),'film-qc-')); const video=path.join(dir,'input.mp4');
 try{
  await writeFile(video,await fetchBytes(videoUri));
  const pattern=path.join(dir,'frame-%02d.jpg');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-i',video,'-vf','fps=0.5,scale=640:-2', '-frames:v',String(count),'-q:v','4',pattern]);
  const files=(await import('fs/promises')).readdir(dir).then(xs=>xs.filter(x=>x.startsWith('frame-')&&x.endsWith('.jpg')).sort());
  const names=await files; const frames=[]; for(const n of names){const b=await readFile(path.join(dir,n));frames.push({name:n,data:`data:image/jpeg;base64,${b.toString('base64')}`})}
  return frames;
 } finally {await rm(dir,{recursive:true,force:true})}
}

function fallbackVisualQC(plan:DirectorPlan, ci:number,si:number,shi:number,reason:string):QualityCheck{
 const shot=plan.chapters[ci].scenes[si].shots[shi]; const motion=/(moving|motion|tracking|push-in|pull-out|pan|tilt|walking|running|turning|camera move|movement|dynamic)/i.test(`${shot.prompt} ${shot.action} ${shot.camera}`)?92:58;
 return {score:Math.round((motion*.5)+35),continuityScore:70,motionScore:motion,visualRiskScore:reason?35:12,passed:false,issues:[reason||'Visual analysis was unavailable; manual review required.'],checkedAt:new Date().toISOString(),analysisMode:'heuristic-fallback',reviewRequired:true}
}

export async function runDeepVisualQC(input:{plan:DirectorPlan;chapterIndex:number;sceneIndex:number;shotIndex:number;videoUri?:string}):Promise<QualityCheck>{
 const {plan,chapterIndex:ci,sceneIndex:si,shotIndex:shi,videoUri}=input; if(!videoUri) return fallbackVisualQC(plan,ci,si,shi,'No generated video is attached to this shot.');
 let frames; try{frames=await extractQCFrames(videoUri,4)}catch(e:any){return fallbackVisualQC(plan,ci,si,shi,`Could not extract video frames: ${e?.message||'unknown error'}`)}
 if(!frames.length) return fallbackVisualQC(plan,ci,si,shi,'No usable frames were extracted from the generated video.');
 const key=process.env.AI_GATEWAY_API_KEY; if(!key) return fallbackVisualQC(plan,ci,si,shi,'AI visual analysis is not configured (AI_GATEWAY_API_KEY missing).');
 const shot=plan.chapters[ci].scenes[si].shots[shi]; const scene=plan.chapters[ci].scenes[si]; const prev=shi>0?scene.shots[shi-1]:undefined;
 const prompt=`You are the senior visual quality supervisor for an AI film studio. Analyze the supplied frames from ONE generated video shot. Do not assume the prompt was followed; judge what is visibly present. Return ONLY JSON with keys: score, continuityScore, motionScore, visualRiskScore, passed, issues, characterConsistency, environmentConsistency, temporalConsistency, realism, composition, motionQuality, artifactSeverity, observedSubjects, recommendedAction. Scores 0-100. passed only if score>=80 and artifactSeverity<=20 and temporalConsistency>=75. issues must be concise strings. recommendedAction must be one of keep, regenerate, review.\n\nSHOT TYPE: ${shot.type}\nCAMERA: ${shot.camera}\nACTION: ${shot.action}\nPROMPT: ${shot.prompt}\nSCENE LOCATION: ${scene.location}\nTIME: ${scene.timeOfDay}\nVISUAL STYLE: ${plan.visualStyle}\nPREVIOUS SHOT CONTEXT: ${prev?prev.prompt:'first shot in scene'}\nCHARACTERS: ${plan.characters.map(c=>c.name+': '+c.description).join(' | ')}`;
 const content=[{type:'text',text:prompt},...frames.map(f=>({type:'image_url',image_url:{url:f.data}}))];
 const r=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.VISUAL_QC_MODEL||'google/gemini-2.5-pro',messages:[{role:'user',content}],temperature:0.1,max_tokens:1800,response_format:{type:'json_object'}})});
 const d=await r.json().catch(()=>({})); if(!r.ok) return fallbackVisualQC(plan,ci,si,shi,`Visual model request failed (${r.status}).`);
 try{const raw=d.choices?.[0]?.message?.content;const x=JSON.parse(raw);return {score:Number(x.score)||0,continuityScore:Number(x.continuityScore)||0,motionScore:Number(x.motionScore)||0,visualRiskScore:Number(x.visualRiskScore)||0,passed:Boolean(x.passed),issues:Array.isArray(x.issues)?x.issues.slice(0,8).map(String):[],checkedAt:new Date().toISOString(),analysisMode:'multimodal',reviewRequired:x.recommendedAction==='review'||x.recommendedAction==='regenerate',characterConsistency:Number(x.characterConsistency)||0,environmentConsistency:Number(x.environmentConsistency)||0,temporalConsistency:Number(x.temporalConsistency)||0,realism:Number(x.realism)||0,composition:Number(x.composition)||0,motionQuality:Number(x.motionQuality)||0,artifactSeverity:Number(x.artifactSeverity)||0,observedSubjects:Array.isArray(x.observedSubjects)?x.observedSubjects.map(String):[],recommendedAction:x.recommendedAction||'review',frameCount:frames.length};}catch{return fallbackVisualQC(plan,ci,si,shi,'Visual model returned invalid analysis JSON.')}
}
