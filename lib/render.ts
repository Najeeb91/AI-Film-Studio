import type { DirectorPlan, Timeline, TimelineClip } from './schemas'

export type RenderSubtitle = { start:number; end:number; text:string }
export type RenderInput = { id:string; kind:'video'|'voice'|'music'|'sfx'; uri:string; start:number; duration:number; trimStart:number; trimEnd:number; volume:number; muted:boolean }
export type RenderManifest = {
  version:1; projectId:string; title:string; duration:number; frameRate:number; aspectRatio:'16:9'|'9:16'|'1:1';
  output:{format:'mp4'; videoCodec:'h264'; audioCodec:'aac'; resolution:'1080p'|'4K'};
  inputs:RenderInput[]; subtitles:RenderSubtitle[]; audioMix:{masterVolume:number; narrationDuckDb:number; targetLufs:number; mastering?:import('./schemas').AudioMastering};
  chunks:{index:number; start:number; duration:number}[]; createdAt:string;
}

function sentenceChunks(text:string, total:number):RenderSubtitle[]{
  const parts = text.replace(/\s+/g,' ').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []
  if (!parts.length || total <= 0) return []
  const weights = parts.map(p => Math.max(1, p.trim().split(/\s+/).length))
  const sum = weights.reduce((a,b)=>a+b,0)
  let cursor = 0
  return parts.map((p,i)=>{ const d=total*(weights[i]/sum); const s={start:cursor,end:Math.min(total,cursor+d),text:p.trim()}; cursor=s.end; return s })
}

function chunksFor(total:number, chunkSeconds=300){
  const chunks=[]; let start=0; let index=0
  while(start<total){ const duration=Math.min(chunkSeconds,total-start); chunks.push({index,start,duration}); start+=duration; index++ }
  return chunks
}

function findSource(plan:DirectorPlan, clip:TimelineClip):string|undefined{
  if(clip.kind==='video'){
    for(const ch of plan.chapters) for(const sc of ch.scenes) for(const sh of sc.shots) if(sh.id===clip.sourceId) return sh.videoJob?.videoUri
  }
  if(clip.kind==='music') return (plan.musicTracks||[]).find(a=>a.id===clip.sourceId)?.audioDataUrl
  if(clip.kind==='sfx') return (plan.sfxTracks||[]).find(a=>a.id===clip.sourceId)?.audioDataUrl
  if(clip.kind==='voice') return plan.voiceGeneration?.audioDataUrl
  return undefined
}

export function buildRenderManifest(projectId:string, plan:DirectorPlan, timeline:Timeline, outputOptions?:{resolution?:'1080p'|'4K';aspectRatio?:'16:9'|'9:16'|'1:1';frameRate?:24|30|60}):RenderManifest{
  const inputs:RenderInput[]=[]
  for(const clip of timeline.clips){
    const uri=findSource(plan,clip)
    if(uri) inputs.push({...clip,uri})
  }
  const narration = plan.narrationScript ? sentenceChunks(plan.narrationScript,timeline.duration) : []
  if(plan.voiceGeneration && !inputs.some(x=>x.kind==='voice')) {
    const legacy = (plan as any).voiceAudioDataUrl as string|undefined
    if(legacy) inputs.push({id:`voice-${plan.id}`,kind:'voice',uri:legacy,start:0,duration:timeline.duration,trimStart:0,trimEnd:timeline.duration,volume:1,muted:false})
  }
  const hasMissingVideo = timeline.clips.filter(c=>c.kind==='video').some(c=>!findSource(plan,c))
  if(hasMissingVideo) throw new Error('Every video clip must have a generated video asset before rendering.')
  if(process.env.REQUIRE_DURABLE_MEDIA==='1' && inputs.some(x=>x.uri.startsWith('data:'))) throw new Error('Render requires durable media. Regenerate or persist all generated assets before rendering.')
  return {
    version:1, projectId, title:plan.title, duration:timeline.duration, frameRate:outputOptions?.frameRate||timeline.frameRate, aspectRatio:outputOptions?.aspectRatio||timeline.aspectRatio,
    output:{format:'mp4',videoCodec:'h264',audioCodec:'aac',resolution:outputOptions?.resolution||'1080p'},
    inputs, subtitles:narration,
    audioMix:{masterVolume:plan.audioMix?.masterVolume??1,narrationDuckDb:plan.audioMix?.narrationDuckDb??-9,targetLufs:plan.audioMix?.targetLufs??-14,mastering:plan.audioMix?.mastering},
    chunks:chunksFor(timeline.duration), createdAt:new Date().toISOString()
  }
}
