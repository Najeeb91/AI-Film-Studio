import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { databaseEnabled, ensureDatabase, getProject, upsertProject } from './db'
import { persistMedia, type MediaAsset } from './media'
const file=path.join(process.cwd(),'data','projects.json')
async function load(){try{return JSON.parse(await readFile(file,'utf8'))}catch{return []}}
async function save(x:any){await writeFile(file,JSON.stringify(x,null,2))}

export async function persistVideoForShot(projectId:string, shotId:string, uri:string, mimeType='video/mp4'): Promise<MediaAsset> {
  const asset=await persistMedia({projectId,kind:'video',uri,mimeType,metadata:{shotId,source:'video-provider'}})
  await updateProject(projectId,(p:any)=>{
    for(const ch of p.plan?.chapters||[]) for(const sc of ch.scenes||[]) for(const sh of sc.shots||[]) if(sh.id===shotId){sh.videoJob={...(sh.videoJob||{}),videoUri:asset.uri,mediaAssetId:asset.id,durable:true};sh.status='complete'}
    return p
  })
  return asset
}

export async function persistVoiceForProject(projectId:string, voice:any): Promise<MediaAsset | null> {
  if(!voice?.audioDataUrl) return null
  const asset=await persistMedia({projectId,kind:'audio',uri:voice.audioDataUrl,mimeType:voice.mimeType||'audio/mpeg',metadata:{role:'narration',source:'voice-provider'}})
  await updateProject(projectId,(p:any)=>{p.plan.voiceGeneration={...voice,audioDataUrl:asset.uri,mediaAssetId:asset.id,durable:true};return p})
  return asset
}

export async function persistAudioTrack(projectId:string, track:any): Promise<MediaAsset | null> {
  if(!track?.audioDataUrl) return null
  const asset=await persistMedia({projectId,kind:'audio',uri:track.audioDataUrl,mimeType:track.mimeType||'audio/mpeg',metadata:{role:track.kind,source:'audio-provider',trackId:track.id}})
  return updateProject(projectId,(p:any)=>{
    const key=track.kind==='music'?'musicTracks':'sfxTracks'; const arr=p.plan?.[key]||[]; const i=arr.findIndex((x:any)=>x.id===track.id); const updated={...track,audioDataUrl:asset.uri,mediaAssetId:asset.id,durable:true}; if(i>=0)arr[i]=updated;else arr.push(updated); p.plan[key]=arr; return p
  }).then(()=>asset)
}

async function updateProject(id:string, fn:(p:any)=>any){
  if(process.env.NODE_ENV==='production' && !databaseEnabled) throw new Error('Project storage is not configured. Add DATABASE_URL to the AI Film Studio Vercel project.')
  if(databaseEnabled){await ensureDatabase();const p=await getProject(id);if(!p)throw new Error('Project not found.');await upsertProject(id,fn(p));return}
  const ps=await load();const i=ps.findIndex((p:any)=>p.id===id);if(i<0)throw new Error('Project not found.');ps[i]=fn(ps[i]);ps[i].updatedAt=new Date().toISOString();await save(ps)
}

export async function ensureProjectMediaDurable(projectId:string) {
  if(!process.env.BLOB_READ_WRITE_TOKEN) return {projectId,persisted:0,skipped:true}
  let count=0
  await updateProject(projectId,(p:any)=>p)
  const project = databaseEnabled ? await getProject(projectId) : (await load()).find((x:any)=>x.id===projectId)
  if(!project) throw new Error('Project not found.')
  for(const ch of project.plan?.chapters||[]) for(const sc of ch.scenes||[]) for(const sh of sc.shots||[]) {
    const u=sh.videoJob?.videoUri
    if(u && !sh.videoJob?.durable){const a=await persistVideoForShot(projectId,sh.id,u,'video/mp4');count++}
  }
  const v=project.plan?.voiceGeneration
  if(v?.audioDataUrl && !v.durable){await persistVoiceForProject(projectId,v);count++}
  for(const key of ['musicTracks','sfxTracks']) for(const a of project.plan?.[key]||[]) if(a.audioDataUrl && !a.durable){await persistAudioTrack(projectId,a);count++}
  return {projectId,persisted:count,skipped:false}
}
