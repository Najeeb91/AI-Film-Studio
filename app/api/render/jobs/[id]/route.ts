import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { databaseEnabled,ensureDatabase,getRenderJob } from '@/lib/db'
const file=path.join(process.cwd(),'data','projects.json')
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params
  if(databaseEnabled){await ensureDatabase(); const job=await getRenderJob(id); return job?NextResponse.json({job}):NextResponse.json({error:'Render job not found.'},{status:404})}
  const projects=JSON.parse(await readFile(file,'utf8')); const p=projects.find((x:any)=>x.renderJob?.id===id); if(!p)return NextResponse.json({error:'Render job not found.'},{status:404}); return NextResponse.json({job:p.renderJob})
}
