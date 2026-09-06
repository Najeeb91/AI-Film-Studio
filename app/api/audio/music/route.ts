import {NextResponse} from 'next/server'
import {generateMusic} from '@/lib/audio'
import {persistAudioTrack} from '@/lib/project-media'
export async function POST(req:Request){try{const b=await req.json();const prompt=String(b.prompt||'').trim();if(!prompt)return NextResponse.json({error:'Music prompt is required.'},{status:400});const asset=await generateMusic(prompt,Number(b.durationSeconds)||30);if(b.projectId&&process.env.BLOB_READ_WRITE_TOKEN){const durable=await persistAudioTrack(String(b.projectId),asset);return NextResponse.json({asset:{...asset,audioDataUrl:durable?.uri||asset.audioDataUrl,mediaAssetId:durable?.id,durable:Boolean(durable)}})}return NextResponse.json({asset})}catch(e:any){return NextResponse.json({error:e?.message||'Music generation failed.'},{status:500})}}
