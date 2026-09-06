import { NextResponse } from 'next/server'
import { transitionForCuts } from '@/lib/editor-engine'
import type { DirectorPlan } from '@/lib/schemas'
export async function POST(req: Request){try{const {plan}=await req.json() as {plan:DirectorPlan};if(!plan)return NextResponse.json({error:'Plan is required.'},{status:400});return NextResponse.json({timeline:transitionForCuts(plan),summary:'AI Editor applied restrained, scene-aware transitions while protecting cinematic hard cuts.'})}catch(e:any){return NextResponse.json({error:e?.message||'AI edit failed.'},{status:500})}}
