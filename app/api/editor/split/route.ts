import { NextResponse } from 'next/server'
import { splitVideoClip } from '@/lib/editor-engine'
import type { Timeline } from '@/lib/schemas'
export async function POST(req:Request){try{const {timeline,clipId,atSeconds}=await req.json() as {timeline:Timeline;clipId:string;atSeconds:number};if(!timeline||!clipId)return NextResponse.json({error:'Timeline and clipId are required.'},{status:400});return NextResponse.json({timeline:splitVideoClip(timeline,clipId,Number(atSeconds))})}catch(e:any){return NextResponse.json({error:e?.message||'Split failed.'},{status:500})}}
