import {NextResponse} from 'next/server'
import {optimizeProductionPlan} from '@/lib/production-planner'
export async function POST(req:Request){try{const {plan}=await req.json();if(!plan)return NextResponse.json({error:'Plan is required.'},{status:400});const optimized=await optimizeProductionPlan(plan);return NextResponse.json({plan:optimized,blueprint:optimized.productionBlueprint,mode:process.env.AI_GATEWAY_API_KEY?'llm':'deterministic'})}catch(e:any){return NextResponse.json({error:e?.message||'Production planning failed.'},{status:500})}}
