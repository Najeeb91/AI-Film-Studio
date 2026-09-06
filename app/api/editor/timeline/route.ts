import { NextResponse } from 'next/server'
import { buildTimeline } from '@/lib/timeline'
import type { DirectorPlan } from '@/lib/schemas'
export async function POST(req: Request) { try { const { plan } = await req.json() as { plan: DirectorPlan }; if (!plan) return NextResponse.json({error:'Plan is required.'},{status:400}); return NextResponse.json({timeline:buildTimeline(plan)}) } catch(e:any){ return NextResponse.json({error:e?.message||'Unable to build timeline.'},{status:500}) } }
