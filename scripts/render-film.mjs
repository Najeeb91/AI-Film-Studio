#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const exec=promisify(execFile)

const manifestPath=process.argv[2]
const outputPath=process.argv[3] || 'final-film.mp4'
if(!manifestPath){console.error('Usage: node scripts/render-film.mjs manifest.json output.mp4');process.exit(1)}
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'))
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ai-film-render-'))
const inputs=manifest.inputs||[]
const videos=inputs.filter(x=>x.kind==='video'&&!x.muted).sort((a,b)=>a.start-b.start)
if(!videos.length) throw new Error('No generated video assets found.')

async function materialize(uri,name){
  const out=path.join(tmp,name)
  if(uri.startsWith('data:')){ const m=uri.match(/^data:([^;]+);base64,(.*)$/s); if(!m)throw new Error('Invalid data URI'); await fs.writeFile(out,Buffer.from(m[2],'base64')); return out }
  if(uri.startsWith('file://')){ await fs.copyFile(new URL(uri),out); return out }
  const r=await fetch(uri); if(!r.ok)throw new Error(`Could not download ${uri}: ${r.status}`); await fs.writeFile(out,Buffer.from(await r.arrayBuffer())); return out
}

const videoPaths=[]
for(let i=0;i<videos.length;i++) videoPaths.push(await materialize(videos[i].uri,`v-${i}.mp4`))
const concatFile=path.join(tmp,'concat.txt')
await fs.writeFile(concatFile,videoPaths.map(p=>`file '${p.replaceAll("'","'\\''")}'`).join('\n'))
const joined=path.join(tmp,'joined.mp4')
await exec('ffmpeg',['-y','-f','concat','-safe','0','-i',concatFile,'-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',joined],{maxBuffer:10*1024*1024})

const audioInputs=inputs.filter(x=>['voice','music','sfx'].includes(x.kind)&&!x.muted)
let cmd=['-y','-i',joined]
const filters=[]
const mixLabels=[]
for(let i=0;i<audioInputs.length;i++){
  const a=audioInputs[i]; const file=await materialize(a.uri,`a-${i}.mp3`); cmd.push('-i',file)
  const delay=Math.max(0,Math.round(a.start*1000)); const trim=Math.max(.1,a.duration)
  filters.push(`[${i+1}:a]atrim=0:${trim.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delay}|${delay},volume=${(a.volume??1).toFixed(3)}[a${i}]`)
  mixLabels.push(`[a${i}]`)
}
if(audioInputs.length){
  filters.push(`${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=2,volume=${(manifest.audioMix?.masterVolume??1).toFixed(3)},loudnorm=I=${manifest.audioMix?.targetLufs??-14}:TP=-1.5:LRA=11[aout]`)
  cmd.push('-filter_complex',filters.join(';'),'-map','0:v:0','-map','[aout]','-c:v','copy','-c:a','aac','-b:a','192k','-shortest',outputPath)
}else{
  cmd.push('-map','0:v:0','-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000','-map','1:a:0','-c:v','copy','-c:a','aac','-shortest',outputPath)
}
await exec('ffmpeg',cmd,{maxBuffer:20*1024*1024})
console.log(JSON.stringify({ok:true,outputPath,duration:manifest.duration,temporaryDirectory:tmp},null,2))
