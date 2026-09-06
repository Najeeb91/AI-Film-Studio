import type { DirectorPlan, Timeline, TimelineClip } from './schemas'

export type TransitionType = TimelineClip['transition'] | 'fadeblack' | 'fadewhite' | 'wipeleft' | 'slideright' | 'smoothleft'

export function transitionForCuts(plan: DirectorPlan): Timeline {
  const base = plan.timeline ? structuredClone(plan.timeline) : buildBase(plan)
  const videos = base.clips.filter(c => c.kind === 'video').sort((a,b)=>a.start-b.start)
  for (let i=0;i<videos.length;i++) {
    const clip = videos[i]
    const prev = videos[i-1]
    if (!prev) { clip.transition='cut'; clip.transitionDuration=0; continue }
    const sceneChange = clip.label.split(' · ')[0] !== prev.label.split(' · ')[0]
    const shotType = clip.label.toLowerCase()
    if (sceneChange) { clip.transition='dissolve'; clip.transitionDuration=0.35 }
    else if (/close|extreme|hero/.test(shotType)) { clip.transition='cut'; clip.transitionDuration=0 }
    else if (/establish|wide/.test(shotType)) { clip.transition='fade'; clip.transitionDuration=0.25 }
    else { clip.transition='cut'; clip.transitionDuration=0 }
  }
  return { ...base, version: 2 }
}

export function splitVideoClip(timeline: Timeline, clipId: string, atSeconds: number): Timeline {
  const clip = timeline.clips.find(c=>c.id===clipId)
  if (!clip || clip.kind!=='video') return timeline
  const local = Math.max(0.25, Math.min(clip.duration-0.25, atSeconds-clip.start))
  if (local<=0 || local>=clip.duration) return timeline
  const left: TimelineClip = {...clip, id:`${clip.id}-a`, duration:local, trimEnd:clip.trimStart+local, transition:'cut', transitionDuration:0}
  const right: TimelineClip = {...clip, id:`${clip.id}-b`, start:clip.start+local, duration:clip.duration-local, trimStart:clip.trimStart+local, trimEnd:clip.trimEnd, transition:clip.transition, transitionDuration:clip.transitionDuration}
  return {...timeline,version:2,clips:timeline.clips.flatMap(c=>c.id===clipId?[left,right]:[c])}
}

export function normalizeTimeline(timeline: Timeline): Timeline {
  const videos = timeline.clips.filter(c=>c.kind==='video').sort((a,b)=>a.start-b.start)
  let cursor=0
  const ids = new Set(videos.map(v=>v.id))
  const clips = timeline.clips.map(c=> {
    if(!ids.has(c.id)) return c
    const v={...c,start:cursor,duration:Math.max(.5,c.duration),trimEnd:c.trimStart+Math.max(.5,c.duration),transitionDuration:Math.max(0,Math.min(c.transitionDuration??0,Math.max(0,c.duration-.05)))}
    cursor += v.duration
    return v
  })
  return {...timeline,clips,duration:cursor,version:2}
}

function buildBase(plan: DirectorPlan): Timeline {
  const clips: TimelineClip[]=[]; let cursor=0
  for(const ch of plan.chapters) for(const sc of ch.scenes) for(const sh of sc.shots){clips.push({id:`clip-${sh.id}`,kind:'video',sourceId:sh.id,start:cursor,duration:sh.duration,trimStart:0,trimEnd:sh.duration,volume:1,muted:false,label:`${ch.title} · ${sc.title} · ${sh.type}`,transition:'cut',transitionDuration:0});cursor+=sh.duration}
  if(plan.voiceGeneration) clips.push({id:`voice-${plan.id}`,kind:'voice',sourceId:`voice-${plan.id}`,start:0,duration:cursor,trimStart:0,trimEnd:cursor,volume:1,muted:false,label:'Narration',transition:'none',transitionDuration:0})
  for(const t of plan.musicTracks||[]) clips.push({id:`music-${t.id}`,kind:'music',sourceId:t.id,start:t.startSeconds||0,duration:t.durationSeconds,trimStart:0,trimEnd:t.durationSeconds,volume:t.volume??.35,muted:false,label:'Music',transition:'fade',transitionDuration:0})
  for(const t of plan.sfxTracks||[]) clips.push({id:`sfx-${t.id}`,kind:'sfx',sourceId:t.id,start:t.startSeconds||0,duration:t.durationSeconds,trimStart:0,trimEnd:t.durationSeconds,volume:t.volume??.8,muted:false,label:'SFX',transition:'cut',transitionDuration:0})
  return {id:`timeline-${plan.id}`,version:2,duration:cursor,clips,playhead:0,frameRate:30,aspectRatio:'16:9'}
}
