import {NextResponse} from 'next/server'
import {getOpsStatus} from '@/lib/ops'
import {requireInternalSecret,requestId} from '@/lib/security'
export const dynamic='force-dynamic'
export async function GET(req:Request){
  const auth=requireInternalSecret(req,process.env.OPS_STATUS_SECRET||process.env.RENDER_WORKER_SECRET)
  const rid=requestId(req)
  if(!auth.ok) return NextResponse.json({ok:false,error:'Unauthorized',requestId:rid},{status:401,headers:{'x-request-id':rid}})
  try{return NextResponse.json({ok:true,service:'ai-film-studio',version:'v28',timestamp:new Date().toISOString(),status:await getOpsStatus()},{headers:{'x-request-id':rid}})}
  catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Ops status failed',requestId:rid},{status:503,headers:{'x-request-id':rid}})}
}
