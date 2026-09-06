import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
const [jobId,projectId,manifestPath]=process.argv.slice(2)
const dataFile=path.join(process.cwd(),'data','projects.json')
async function load(){return JSON.parse(await fs.readFile(dataFile,'utf8'))}
async function update(patch){const ps=await load();const p=ps.find(x=>x.id===projectId);if(!p)return;p.renderJob={...p.renderJob,...patch,updatedAt:new Date().toISOString()};p.progress=p.renderJob.progress;p.status=p.renderJob.status==='completed'?'Completed':'Rendering';await fs.writeFile(dataFile,JSON.stringify(ps,null,2))}
function run(args){return new Promise((resolve,reject)=>{const c=spawn('ffmpeg',args,{stdio:['ignore','pipe','pipe']});let err='';c.stderr.on('data',d=>{err+=d.toString()});c.on('close',code=>code===0?resolve():reject(new Error(err.slice(-4000)||`ffmpeg exited ${code}`)))} )}
try{
 const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8')); await update({status:'preparing',progress:5});
 const outDir=path.join(process.cwd(),'data','renders');await fs.mkdir(outDir,{recursive:true});const output=path.join(outDir,`${jobId}.mp4`)
 const videos=(manifest.inputs||[]).filter(x=>x.kind==='video'&&!x.muted).sort((a,b)=>a.start-b.start)
 if(!videos.length)throw new Error('No generated video assets found.')
 const tmp=await fs.mkdtemp(path.join(outDir,`${jobId}-`))
 async function materialize(uri,name){const out=path.join(tmp,name);if(uri.startsWith('data:')){const m=uri.match(/^data:([^;]+);base64,(.*)$/s);if(!m)throw new Error('Invalid data URI');await fs.writeFile(out,Buffer.from(m[2],'base64'));return out}if(uri.startsWith('file://')){await fs.copyFile(new URL(uri),out);return out}const r=await fetch(uri);if(!r.ok)throw new Error(`Media download failed: ${r.status}`);await fs.writeFile(out,Buffer.from(await r.arrayBuffer()));return out}
 const vp=[];for(let i=0;i<videos.length;i++)vp.push(await materialize(videos[i].uri,`v-${i}.mp4`));await update({status:'rendering',progress:15})
 const concat=path.join(tmp,'concat.txt');await fs.writeFile(concat,vp.map(p=>`file '${p.replaceAll("'","'\\''")}'`).join('\n'));const joined=path.join(tmp,'joined.mp4');await run(['-y','-f','concat','-safe','0','-i',concat,'-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',joined]);await update({progress:55})
 const aud=(manifest.inputs||[]).filter(x=>['voice','music','sfx'].includes(x.kind)&&!x.muted);let args=['-y','-i',joined];const filters=[];const labels=[]
 const hasVoice=aud.some(a=>a.kind==='voice'); const duckDb=manifest.audioMix?.narrationDuckDb??-9;
 for(let i=0;i<aud.length;i++){const a=aud[i];const f=await materialize(a.uri,`a-${i}.mp3`);args.push('-i',f);const delay=Math.max(0,Math.round(a.start*1000));const base=a.volume??1;const duck=(hasVoice&&a.kind==='music')?Math.pow(10,duckDb/20):1;filters.push(`[${i+1}:a]atrim=0:${Math.max(.1,a.duration).toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delay}|${delay},volume=${(base*duck).toFixed(4)}[a${i}]`);labels.push(`[a${i}]`)}
 if(aud.length){filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:dropout_transition=2,volume=${(manifest.audioMix?.masterVolume??1).toFixed(3)},loudnorm=I=${manifest.audioMix?.targetLufs??-14}:TP=-1.5:LRA=11[aout]`);args.push('-filter_complex',filters.join(';'),'-map','0:v:0','-map','[aout]','-c:v','copy','-c:a','aac','-b:a','192k','-shortest',output)}else args.push('-map','0:v:0','-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000','-map','1:a:0','-c:v','copy','-c:a','aac','-shortest',output)
 await run(args);
 if((manifest.subtitles||[]).length){const srt=path.join(tmp,'subtitles.srt');const fmt=x=>{const ms=Math.round((x-Math.floor(x))*1000),t=Math.floor(x);return `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor((t%3600)/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')},${String(ms).padStart(3,'0')}`};await fs.writeFile(srt,(manifest.subtitles||[]).map((x,i)=>`${i+1}\n${fmt(x.start)} --> ${fmt(x.end)}\n${x.text}\n`).join('\n'));const burned=path.join(tmp,'burned.mp4');await run(['-y','-i',output,'-vf',`subtitles=${srt.replaceAll('\\','/').replaceAll(':','\\:')}:force_style='FontName=Arial,FontSize=20,Outline=2,Shadow=1,Alignment=2'`,'-c:v','libx264','-preset','medium','-crf','19','-c:a','copy',burned]);await fs.rename(burned,output)}
 await update({status:'completed',progress:100,outputUri:`/api/render/output/${jobId}`,completedAt:new Date().toISOString()});await fs.rm(tmp,{recursive:true,force:true})
}catch(e){await update({status:'failed',progress:0,error:e.message})}
