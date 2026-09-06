import {NextResponse} from 'next/server'
import {readFile,writeFile} from 'fs/promises'
import path from 'path'
import {databaseEnabled,ensureDatabase,upsertProject,listProjects} from '@/lib/db'
const file=path.join(process.cwd(),'data','projects.json')
async function load(){try{return JSON.parse(await readFile(file,'utf8'))}catch{return []}}
export async function GET(){
  if(process.env.NODE_ENV==='production' && !databaseEnabled){
    return NextResponse.json({error:'Project storage is not configured. Add DATABASE_URL to the AI Film Studio Vercel project.',code:'DATABASE_NOT_CONFIGURED'},{status:503})
  }
  if(databaseEnabled){
    try{ await ensureDatabase(); return NextResponse.json({projects:await listProjects()}) }
    catch(e:unknown){
      const message=e instanceof Error?e.message:'Database initialization failed.'
      return NextResponse.json({error:`Project database unavailable: ${message}`,code:'DATABASE_UNAVAILABLE'},{status:503})
    }
  }
  return NextResponse.json({projects:await load()})
}
export async function POST(req:Request){
  try{
    const body=await req.json(); const project={id:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'Planned',progress:8,...body}
    if(process.env.NODE_ENV==='production' && !databaseEnabled){
      return NextResponse.json({error:'Project storage is not configured. Add DATABASE_URL to the AI Film Studio Vercel project.',code:'DATABASE_NOT_CONFIGURED'},{status:503})
    }
    if(databaseEnabled){
      await ensureDatabase();
      await upsertProject(project.id,project)
    } else {
      const projects=await load(); projects.unshift(project); await writeFile(file,JSON.stringify(projects,null,2))
    }
    return NextResponse.json({project},{status:201})
  }catch(e:unknown){
    const message=e instanceof Error?e.message:'Unable to save project.'
    return NextResponse.json({error:`Unable to save project: ${message}`,code:'PROJECT_SAVE_FAILED'},{status:500})
  }
}
