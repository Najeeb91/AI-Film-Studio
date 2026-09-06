import {NextResponse} from 'next/server'
import {readFile,writeFile} from 'fs/promises'
import path from 'path'
import {databaseEnabled,ensureDatabase,getProject,upsertProject} from '@/lib/db'
const file=path.join(process.cwd(),'data','projects.json')
async function load(){try{return JSON.parse(await readFile(file,'utf8'))}catch{return []}}
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params
  if(process.env.NODE_ENV==='production' && !databaseEnabled) return NextResponse.json({error:'Project storage is not configured. Add DATABASE_URL to the AI Film Studio Vercel project.',code:'DATABASE_NOT_CONFIGURED'},{status:503})
  if(databaseEnabled){await ensureDatabase(); const p=await getProject(id); return p?NextResponse.json({project:p}):NextResponse.json({error:'Project not found.'},{status:404})}
  const p=(await load()).find((x:any)=>x.id===id); return p?NextResponse.json({project:p}):NextResponse.json({error:'Project not found.'},{status:404})
}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params; const patch=await req.json()
  if(process.env.NODE_ENV==='production' && !databaseEnabled) return NextResponse.json({error:'Project storage is not configured. Add DATABASE_URL to the AI Film Studio Vercel project.',code:'DATABASE_NOT_CONFIGURED'},{status:503})
  if(databaseEnabled){await ensureDatabase(); const p=await getProject(id); if(!p)return NextResponse.json({error:'Project not found.'},{status:404}); const updated={...p,...patch,updatedAt:new Date().toISOString()}; await upsertProject(id,updated); return NextResponse.json({project:updated})}
  const projects=await load(); const i=projects.findIndex((x:any)=>x.id===id); if(i<0)return NextResponse.json({error:'Project not found.'},{status:404}); projects[i]={...projects[i],...patch,updatedAt:new Date().toISOString()}; await writeFile(file,JSON.stringify(projects,null,2)); return NextResponse.json({project:projects[i]})
}
