#!/usr/bin/env node
/**
 * AI Film Studio V11 production render worker.
 * Self-host this service anywhere with FFmpeg + enough temporary disk.
 * POST /render with {jobId, projectId, manifest, callbackUrl}.
 */
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import { put } from '@vercel/blob'

const PORT=Number(process.env.PORT||8787)
const SECRET=process.env.RENDER_WORKER_SECRET||''
const BLOB_TOKEN=process.env.BLOB_READ_WRITE_TOKEN||''
const active=new Set()
function outputSize(manifest){const r=manifest.output?.resolution==='4K'?3840:1920;const a=manifest.aspectRatio||'16:9';if(a==='9:16')return {w:a==='9:16'?Math.round(r*9/16):r,h:r};if(a==='1:1')return {w:r,h:r};return {w:r,h:Math.round(r*9/16)}}

function run(bin,args){return new Promise((resolve,reject)=>{const p=spawn(bin,args,{stdio:['ignore','pipe','pipe']});let err='';p.stderr.on('data',d=>{err+=d.toString()});p.on('close',code=>code===0?resolve():reject(new Error(err.slice(-6000)||`${bin} exited ${code}`)))})}
async function download(uri,out){
  if(uri.startsWith('data:')){const m=uri.match(/^data:([^;]+);base64,(.*)$/s);if(!m)throw new Error('Invalid data URI');await fs.writeFile(out,Buffer.from(m[2],'base64'));return}
  if(uri.startsWith('file://')){await fs.copyFile(new URL(uri),out);return}
  const r=await fetch(uri);if(!r.ok)throw new Error(`Media download failed: ${r.status}`);await fs.writeFile(out,Buffer.from(await r.arrayBuffer()))
}
function overlap(c,chunk){const s=Math.max(c.start,chunk.start),e=Math.min(c.start+c.duration,chunk.start+chunk.duration);return e>s?{start:s,end:e,duration:e-s,trimStart:(c.trimStart||0)+(s-c.start),trimEnd:(c.trimStart||0)+(s-c.start)+(e-s)}:null}
async function renderChunk(manifest,chunk,tmp,index,files){
  const clips=(manifest.inputs||[]).filter(x=>x.kind==='video'&&!x.muted).map(x=>({x,o:overlap(x,chunk)})).filter(z=>z.o).sort((a,b)=>a.o.start-b.o.start)
  if(!clips.length) throw new Error(`Chunk ${index} contains no video.`)
  const paths=[]
  for(let i=0;i<clips.length;i++){
    const {x,o}=clips[i]; const src=files.get(x.id)||path.join(tmp,`video-${i}.mp4`)
    if(!files.has(x.id)){await download(x.uri,src);files.set(x.id,src)}
    const out=path.join(tmp,`c-${index}-${i}.mp4`)
    await run('ffmpeg',['-y','-ss',String(Math.max(0,o.trimStart)),'-i',src,'-t',String(o.duration),'-an','-c:v','libx264','-preset','medium','-crf','18','-vf',`scale=${outputSize(manifest).w}:${outputSize(manifest).h}:force_original_aspect_ratio=decrease,pad=${outputSize(manifest).w}:${outputSize(manifest).h}:(ow-iw)/2:(oh-ih)/2`,'-pix_fmt','yuv420p','-r',String(manifest.frameRate||24),out])
    paths.push(out)
  }
  if(paths.length===1) return paths[0]
  const inputs=[]
  for(const p of paths) inputs.push('-i',p)
  const filters=[]; let current='[0:v]'; let accumulated=0
  for(let i=1;i<paths.length;i++){
    const prev=clips[i].x
    const transition=(prev.transition||'cut')
    const dur=Math.max(0,Math.min(Number(prev.transitionDuration||0), clips[i-1].o.duration/2, clips[i].o.duration/2))
    if(transition==='cut'||dur<=0){current=`[${i}:v]`; accumulated += clips[i-1].o.duration; continue}
    const effect=transition==='dissolve'?'fade':transition
    const out=`[v${i}]`
    const offset=Math.max(0, accumulated + clips[i-1].o.duration - dur)
    filters.push(`${current}[${i}:v]xfade=transition=${effect}:duration=${dur.toFixed(3)}:offset=${offset.toFixed(3)}${out}`)
    current=out; accumulated=offset + clips[i].o.duration
  }
  const out=path.join(tmp,`chunk-${index}.mp4`)
  if(filters.length){await run('ffmpeg',['-y',...inputs,'-filter_complex',filters.join(';'),'-map',current,'-an','-c:v','libx264','-preset','medium','-crf','18','-vf',`scale=${outputSize(manifest).w}:${outputSize(manifest).h}:force_original_aspect_ratio=decrease,pad=${outputSize(manifest).w}:${outputSize(manifest).h}:(ow-iw)/2:(oh-ih)/2`,'-pix_fmt','yuv420p','-r',String(manifest.frameRate||24),out])}
  else {const concat=path.join(tmp,`concat-${index}.txt`);await fs.writeFile(concat,paths.map(p=>`file '${p.replaceAll("'","'\\''")}'`).join('\n'));await run('ffmpeg',['-y','-f','concat','-safe','0','-i',concat,'-an','-c:v','libx264','-preset','medium','-crf','18','-vf',`scale=${outputSize(manifest).w}:${outputSize(manifest).h}:force_original_aspect_ratio=decrease,pad=${outputSize(manifest).w}:${outputSize(manifest).h}:(ow-iw)/2:(oh-ih)/2`,'-pix_fmt','yuv420p','-r',String(manifest.frameRate||24),out])}
  return out
}
async function uploadFile(file,pathname,contentType){
  if(!BLOB_TOKEN) return null
  const data=await fs.readFile(file)
  const saved=await put(pathname,data,{access:'public',contentType,addRandomSuffix:false,token:BLOB_TOKEN})
  return saved.url
}
async function renderJob(body,notify){
  const {jobId,manifest,callbackUrl}=body;if(!jobId||!manifest)throw new Error('jobId and manifest are required.')
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),`ai-film-${jobId}-`));const files=new Map();
  try{
    await notify('preparing',5)
    const chunks=manifest.chunks||[{index:0,start:0,duration:manifest.duration}];const rendered=[]
    for(let i=0;i<chunks.length;i++){const p=await renderChunk(manifest,chunks[i],tmp,i,files);rendered.push(p);await notify('rendering',15+Math.round(((i+1)/chunks.length)*65),{chunkIndex:i,chunkCount:chunks.length,chunkStart:chunks[i].start,chunkDuration:chunks[i].duration,chunkStatus:'completed',chunkProgress:100})}
    const concat=path.join(tmp,'final-concat.txt');await fs.writeFile(concat,rendered.map(p=>`file '${p.replaceAll("'","'\\''")}'`).join('\n'));const joined=path.join(tmp,'joined.mp4');await run('ffmpeg',['-y','-f','concat','-safe','0','-i',concat,'-an','-c:v','libx264','-preset','medium','-crf',manifest.output?.resolution==='4K'?'17':'18','-profile:v','high','-pix_fmt','yuv420p','-r',String(manifest.frameRate||24),joined])
    await notify('rendering',85)
    let final=joined
    const audio=(manifest.inputs||[]).filter(x=>['voice','music','sfx'].includes(x.kind)&&!x.muted)
    if(audio.length){
      const args=['-y','-i',joined], filters=[], labels=[]
      const mastering=manifest.audioMix?.mastering||{}
      const voiceGain=Math.pow(10,Number(mastering.voiceGainDb||0)/20)
      const musicGain=Math.pow(10,Number(mastering.musicGainDb||0)/20)
      const sfxGain=Math.pow(10,Number(mastering.sfxGainDb||0)/20)
      const voiceInputs=[]
      for(let i=0;i<audio.length;i++){
        const a=audio[i],f=files.get(a.id)||path.join(tmp,`audio-${i}.mp3`)
        if(!files.has(a.id)){await download(a.uri,f);files.set(a.id,f)}
        args.push('-i',f)
        const delay=Math.max(0,Math.round((a.start||0)*1000))
        const vol=(a.volume??1)*(a.kind==='voice'?voiceGain:a.kind==='music'?musicGain:sfxGain)
        const dur=Math.max(.1,Number(a.duration||manifest.duration))
        const fadeIn=Math.max(0,Math.min(Number(a.fadeIn||0),dur/2))
        const fadeOut=Math.max(0,Math.min(Number(a.fadeOut||0),dur/2))
        let chain=`atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS`
        if(fadeIn>0) chain+=`,afade=t=in:st=0:d=${fadeIn.toFixed(3)}`
        if(fadeOut>0) chain+=`,afade=t=out:st=${Math.max(0,dur-fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`
        chain+=`,adelay=${delay}|${delay},volume=${vol.toFixed(4)}`
        if(a.kind==='voice'){filters.push(`[${i+1}:a]${chain}[voice${i}]`);voiceInputs.push(`[voice${i}]`)}
        else filters.push(`[${i+1}:a]${chain}[a${i}]`)
        labels.push(a.kind==='voice'?`[voice${i}]`:`[a${i}]`)
      }
      // Dynamic narration ducking: music is compressed against the voice sidechain instead of simply being turned down.
      const duckDb=Number(mastering.musicDuckDb ?? manifest.audioMix?.narrationDuckDb ?? -9)
      const ratio=Math.max(1.5,Math.min(20,Math.abs(duckDb)+2))
      const attack=Math.max(1,Number(mastering.musicAttackMs||30))
      const release=Math.max(10,Number(mastering.musicReleaseMs||300))
      const processed=[]
      for(let i=0;i<audio.length;i++){
        const a=audio[i]
        if(a.kind==='music' && voiceInputs.length){
          const inLabel=`[a${i}]`, outLabel=`[duck${i}]`
          filters.push(`${inLabel}${voiceInputs[0]}sidechaincompress=threshold=0.08:ratio=${ratio.toFixed(2)}:attack=${attack.toFixed(1)}:release=${release.toFixed(1)}:makeup=1:link=average${outLabel}`)
          processed.push(outLabel)
        } else if(a.kind!=='voice') processed.push(`[a${i}]`)
      }
      processed.push(...voiceInputs)
      if(processed.length){
        filters.push(`${processed.join('')}amix=inputs=${processed.length}:duration=longest:dropout_transition=2,volume=${manifest.audioMix?.masterVolume??1},aresample=48000,loudnorm=I=${mastering.targetLufs??manifest.audioMix?.targetLufs??-14}:TP=${mastering.truePeakDb??-1.5}:LRA=${mastering.lra??11}:linear=true:print_format=summary,alimiter=limit=${Math.pow(10,((mastering.limiterCeilingDb??-1.5)/20)).toFixed(6)}[aout]`)
        final=path.join(tmp,'mixed.mp4')
        args.push('-filter_complex',filters.join(';'),'-map','0:v:0','-map','[aout]','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-shortest',final)
        await run('ffmpeg',args)
      }
    }
    if((manifest.subtitles||[]).length){const srt=path.join(tmp,'subtitles.srt');const fmt=x=>{const ms=Math.round((x-Math.floor(x))*1000),t=Math.floor(x);return `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor((t%3600)/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')},${String(ms).padStart(3,'0')}`};await fs.writeFile(srt,manifest.subtitles.map((x,i)=>`${i+1}\n${fmt(x.start)} --> ${fmt(x.end)}\n${x.text}\n`).join('\n'));const burned=path.join(tmp,'subtitled.mp4');await run('ffmpeg',['-y','-i',final,'-vf',`subtitles=${srt.replaceAll('\\','/').replaceAll(':','\\:')}:force_style='FontName=Arial,FontSize=20,Outline=2,Shadow=1,Alignment=2'`,'-c:v','libx264','-preset','medium','-crf','19','-c:a','copy',burned]);final=burned}
    const outputUri=await uploadFile(final,`films/${body.projectId||'unknown'}/renders/${body.jobId}.mp4`,'video/mp4')
    await notify('completed',100,{outputPath:final,outputUri,temporaryOutput:!outputUri})
    return {outputUri,outputPath:final}
  } finally {setTimeout(()=>fs.rm(tmp,{recursive:true,force:true}).catch(()=>{}),60000)}
}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',d=>{s+=d});req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch(e){reject(e)}})})}
const server=http.createServer(async(req,res)=>{if(req.method==='GET'&&req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,active:active.size}))}if(req.method!=='POST'||req.url!=='/render'){res.writeHead(404);return res.end('Not found')}if(SECRET&&req.headers.authorization!==`Bearer ${SECRET}`){res.writeHead(401);return res.end('Unauthorized')}try{const b=await body(req);if(active.has(b.jobId)){res.writeHead(409);return res.end('Job already active')}active.add(b.jobId);res.writeHead(202,{'content-type':'application/json'});res.end(JSON.stringify({accepted:true,jobId:b.jobId}));const notify=async(status,progress,extra={})=>{if(!b.callbackUrl)return;try{await fetch(b.callbackUrl,{method:'POST',headers:{'content-type':'application/json',...(SECRET?{authorization:`Bearer ${SECRET}`}:{})},body:JSON.stringify({status,progress,...extra})})}catch{}};renderJob(b,notify).catch(e=>notify('failed',0,{error:e.message})).finally(()=>active.delete(b.jobId))}catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}))}})
server.listen(PORT,()=>console.log(`AI Film Studio render worker listening on :${PORT}`))
