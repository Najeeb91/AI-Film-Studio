export type ShotStatus = 'planned'|'approved'|'rejected'|'generating'|'complete'|'failed'
export type QualityCheck = {
  score:number;
  continuityScore:number;
  motionScore:number;
  visualRiskScore:number;
  passed:boolean;
  issues:string[];
  checkedAt:string;
  analysisMode?:'heuristic-fallback'|'multimodal';
  reviewRequired?:boolean;
  characterConsistency?:number;
  environmentConsistency?:number;
  temporalConsistency?:number;
  realism?:number;
  composition?:number;
  motionQuality?:number;
  artifactSeverity?:number;
  observedSubjects?:string[];
  recommendedAction?:'keep'|'regenerate'|'review';
  frameCount?:number;
  continuityBreaks?:string[];
  transitionQuality?:number;
  identityDrift?:number;
  environmentDrift?:number;
  wardrobeDrift?:number;
  propDrift?:number;
  temporalNotes?:string[];
}
export type AudioAsset = { id:string; kind:'music'|'sfx'; provider:string; model:string; prompt:string; durationSeconds:number; mimeType:string; audioDataUrl:string; generatedAt:string; volume:number; startSeconds:number; fadeInSeconds:number; fadeOutSeconds:number; duckUnderVoice:boolean; mediaAssetId?:string; durable?:boolean }
export type VoiceGeneration = { provider:string; model:string; voice:string; mimeType:string; characterCount:number; generatedAt:string; audioDataUrl?:string; mediaAssetId?:string; durable?:boolean }
export type ReferenceType = 'character'|'location'|'prop'|'costume'|'architecture'|'artifact'|'visual'
export type ProjectReference = { id:string; projectId:string; type:ReferenceType; label:string; uri:string; mimeType:string; description?:string; tags?:string[]; active?:boolean; createdAt:string; characterId?:string; locationId?:string; sceneIds?:string[]; shotIds?:string[] }
export type ShotReference = { referenceId:string; role:ReferenceType|'identity'; priority:number; reason:string; included:boolean; source:'auto'|'manual' }
export type ReferenceManifest = { references:ShotReference[]; maxProviderReferences:number; generatedAt:string; version:number }
export type CharacterReference = { id:string; mediaAssetId?:string; uri:string; mimeType:string; label?:string; createdAt:string; active?:boolean }
export type ContinuityState = {
  characterIds:string[];
  characterNames:string[];
  wardrobe:string[];
  props:string[];
  locationId?:string;
  locationName?:string;
  timeOfDay?:string;
  visualStyle?:string;
  matchedReferenceIds?:string[];
  previousShotId?:string;
  previousShotSummary?:string;
  continuityPrompt:string;
  version:number;
  generatedAt:string;
  sceneProgress?: { sequenceIndex:number; totalShots:number; previousShotId?:string; nextShotId?:string; expectedTimeProgression?:string; };
  lockedElements?: { characterIds:string[]; locationId?:string; wardrobe:string[]; props:string[]; references:string[]; visualStyle?:string };
}
export type DialoguePerformance = {
  id:string
  characterId:string
  characterName:string
  text:string
  emotion:string
  delivery:string
  emphasis:string[]
  pauses:number[]
  pronunciation:string[]
  voice?:string
  lipSyncStatus:'planned'|'unsupported'|'processing'|'complete'|'failed'
  createdAt:string
}
export type ShotPerformance = {
  mode:'dialogue'|'narration'|'silent'
  eyeLine:string
  blocking:string
  facialExpression:string
  bodyLanguage:string
  dialogue:DialoguePerformance[]
  performancePrompt:string
  generatedAt:string
  version:number
}
export type Shot = {
  id:string; type:string; duration:number; camera:string; action:string; prompt:string; status:ShotStatus
  videoJob?: { provider:string; model:string; operationName:string; videoUri?:string; mediaAssetId?:string; durable?:boolean; startedAt:string }
  productionJob?: { id:string; status:'queued'|'running'|'complete'|'failed'|'cancelled'; attempts:number; priority:number; queuedAt:string; startedAt?:string; completedAt?:string; error?:string; operationName?:string }
  qualityCheck?: QualityCheck
  continuityState?: ContinuityState
  referenceManifest?: ReferenceManifest
  performance?: ShotPerformance
  regeneration?: { attempts:number; lastStartedAt?:string; lastCompletedAt?:string; lastDiagnosis?:string[]; lastRepairChanges?:string[] }
}
export type Scene = { id:string; title:string; purpose:string; location:string; timeOfDay:string; shots:Shot[] }
export type Chapter = { id:string; title:string; summary:string; scenes:Scene[] }
export type TimelineClip = { id:string; kind:'video'|'voice'|'music'|'sfx'; sourceId:string; start:number; duration:number; trimStart:number; trimEnd:number; volume:number; muted:boolean; label:string; transition:'cut'|'fade'|'dissolve'|'fadeblack'|'fadewhite'|'wipeleft'|'slideright'|'smoothleft'|'none'; transitionDuration?:number; speed?:number }
export type Timeline = { id:string; version:number; duration:number; clips:TimelineClip[]; playhead:number; frameRate:number; aspectRatio:'16:9'|'9:16'|'1:1' }
export type RenderJobStatus = 'queued'|'preparing'|'rendering'|'completed'|'failed'
export type RenderJob = { id:string; projectId:string; status:RenderJobStatus; progress:number; manifestVersion:number; outputUri?:string; error?:string; startedAt?:string; completedAt?:string; updatedAt:string }

export type ProductionBlueprint = {
  version:number; targetRuntimeSeconds:number; plannedRuntimeSeconds:number; coverageScore:number; pacingPlan:string; editorialIntent:string; generationProfile:string; heroShotCount:number; standardShotCount:number; scenePlans:{sceneId:string; objective:string; emotionalBeat:string; shotStrategy:string; priority:'hero'|'standard'}[]; riskFlags:string[]; generatedAt:string
}
export type AudioMastering = {
  enabled:boolean; targetLufs:number; truePeakDb:number; lra:number; limiterCeilingDb:number;
  musicDuckDb:number; musicAttackMs:number; musicReleaseMs:number;
  voiceGainDb:number; musicGainDb:number; sfxGainDb:number;
  crossfadeMs:number; silenceTrimMs:number; masteringNotes:string[];
  analyzedAt?:string; analysisMode?:'planned'|'ffmpeg-analysis';
}
export type DirectorPlan = { id:string; title:string; logline:string; genre:string; durationMinutes:number; chapters:Chapter[]; references?:ProjectReference[]; characters:{id:string;name:string;description:string;voice:string;referenceImages?:CharacterReference[]}[]; locations:{id:string;name:string;description:string}[]; visualStyle:string; narrationStyle:string; productionBlueprint?:ProductionBlueprint; narrationScript?:string; voiceGeneration?:VoiceGeneration; musicTracks?:AudioAsset[]; sfxTracks?:AudioAsset[]; audioMix?:{masterVolume:number; narrationDuckDb:number; targetLufs:number; notes:string; mastering?:AudioMastering}; timeline?:Timeline; createdAt:string }
