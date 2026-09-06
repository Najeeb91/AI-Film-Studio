import type { DirectorPlan, Timeline, TimelineClip } from './schemas'

export function buildTimeline(plan: DirectorPlan): Timeline {
  const clips: TimelineClip[] = []
  let cursor = 0
  for (const chapter of plan.chapters) {
    for (const scene of chapter.scenes) {
      for (const shot of scene.shots) {
        const duration = shot.duration
        clips.push({
          id: `clip-${shot.id}`,
          kind: 'video',
          sourceId: shot.id,
          start: cursor,
          duration,
          trimStart: 0,
          trimEnd: duration,
          volume: 1,
          muted: false,
          label: `${chapter.title} · ${scene.title} · ${shot.type}`,
          transition: 'cut', transitionDuration: 0,
        })
        cursor += duration
      }
    }
  }
  if (plan.voiceGeneration) clips.push({ id: `voice-${plan.id}`, kind: 'voice', sourceId: `voice-${plan.id}`, start: 0, duration: cursor, trimStart: 0, trimEnd: cursor, volume: 1, muted: false, label: 'Narration', transition: 'none' })
  for (const track of plan.musicTracks || []) clips.push({ id: `music-${track.id}`, kind: 'music', sourceId: track.id, start: track.startSeconds || 0, duration: track.durationSeconds, trimStart: 0, trimEnd: track.durationSeconds, volume: track.volume ?? 0.35, muted: false, label: 'Music', transition: 'fade' })
  for (const track of plan.sfxTracks || []) clips.push({ id: `sfx-${track.id}`, kind: 'sfx', sourceId: track.id, start: track.startSeconds || 0, duration: track.durationSeconds, trimStart: 0, trimEnd: track.durationSeconds, volume: track.volume ?? 0.8, muted: false, label: 'SFX', transition: 'cut' })
  return { id: `timeline-${plan.id}`, version: 2, duration: cursor, clips, playhead: 0, frameRate: 30, aspectRatio: '16:9' }
}
