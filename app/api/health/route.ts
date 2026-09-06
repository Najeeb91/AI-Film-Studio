import {NextResponse} from 'next/server'
import {databaseEnabled,ensureDatabase} from '@/lib/db'
export const dynamic='force-dynamic'
export async function GET(){
  let database='disabled'
  if(databaseEnabled){try{await ensureDatabase();database='ok'}catch{database='error'}}
  const checks={database,blob:process.env.BLOB_READ_WRITE_TOKEN?'configured':'missing',aiGateway:process.env.AI_GATEWAY_API_KEY?'configured':'missing',video:process.env.GEMINI_API_KEY?'configured':'missing',renderWorker:process.env.RENDER_WORKER_URL?'configured':'missing'}
  const healthy=database!=='error'
  return NextResponse.json({ok:healthy,service:'ai-film-studio',version:'v28',checks,timestamp:new Date().toISOString()},{status:healthy?200:503})
}
