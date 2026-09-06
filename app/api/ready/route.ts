import {NextResponse} from 'next/server'
export const dynamic='force-dynamic'
export async function GET(){
  const required=['AI_GATEWAY_API_KEY','GEMINI_API_KEY','BLOB_READ_WRITE_TOKEN','DATABASE_URL','RENDER_WORKER_URL','RENDER_WORKER_SECRET']
  const missing=required.filter(k=>!process.env[k])
  const productionReady=missing.length===0
  return NextResponse.json({ok:productionReady,productionReady,missing,workerSecretConfigured:Boolean(process.env.RENDER_WORKER_SECRET),timestamp:new Date().toISOString()},{status:productionReady?200:503})
}
