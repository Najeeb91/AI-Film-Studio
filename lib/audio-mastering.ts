import type { AudioMastering, DirectorPlan } from './schemas'

export type AudioMasteringPlan = AudioMastering & {
  stemSummary:{voice:number;music:number;sfx:number;total:number}
}

export function buildAudioMasteringPlan(plan:DirectorPlan):AudioMasteringPlan{
  const voice=plan.voiceGeneration?.audioDataUrl?1:0
  const music=(plan.musicTracks||[]).length
  const sfx=(plan.sfxTracks||[]).length
  const notes:string[]=[]
  if(!voice) notes.push('No narration stem is currently available; music ducking will only activate when a voice stem exists.')
  if(music>1) notes.push('Multiple music stems will be gain-matched before the final master.')
  if(sfx>0) notes.push('SFX remain foreground-capable and are not automatically ducked under narration.')
  notes.push('Final master targets -14 LUFS integrated with -1.5 dBTP ceiling for web delivery.')
  notes.push('Music uses dynamic sidechain ducking rather than static attenuation when narration is present.')
  return {
    enabled:true,targetLufs:plan.audioMix?.targetLufs??-14,truePeakDb:-1.5,lra:11,limiterCeilingDb:-1.5,
    musicDuckDb:plan.audioMix?.narrationDuckDb??-9,musicAttackMs:30,musicReleaseMs:300,
    voiceGainDb:0,musicGainDb:0,sfxGainDb:0,crossfadeMs:30,silenceTrimMs:20,
    masteringNotes:notes,analyzedAt:new Date().toISOString(),analysisMode:'planned',
    stemSummary:{voice,music,sfx,total:voice+music+sfx}
  }
}

export function normalizeMastering(input:Partial<AudioMastering>|undefined, plan:DirectorPlan):AudioMastering{
  const base=buildAudioMasteringPlan(plan)
  return {...base,...input,masteringNotes:Array.isArray(input?.masteringNotes)?input!.masteringNotes!:base.masteringNotes}
}
