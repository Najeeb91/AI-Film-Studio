import {NextResponse} from 'next/server'
import {buildAudioMasteringPlan} from '@/lib/audio-mastering'
import {databaseEnabled,ensureDatabase,getProject} from '@/lib/db'
import {readFile} from 'fs/promises'
import path from 'path'
const file=path.join(process.cwd(),'data','projects.json')
async function load(){try{return JSON.parse(await readFile(file,'utf8'))}catch{return []}}
export async function POST(req:Request){
  try{const b=await req.json();let project:any
    if(databaseEnabled){await ensureDatabase();project=await getProject(b.projectId)}else project=(await load()).find((x:any)=>x.id===b.projectId)
    if(!project)return NextResponse.json({error:'Project not found.'},{status:404})
    return NextResponse.json({mastering:buildAudioMasteringPlan(project.plan)})
  }catch(e:any){return NextResponse.json({error:e.message||'Could not build audio master.'},{status:400})}
}
