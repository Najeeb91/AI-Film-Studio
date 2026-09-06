import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { buildRenderManifest } from '@/lib/render'
const file=path.join(process.cwd(),'data','projects.json')
async function load(){return JSON.parse(await readFile(file,'utf8'))}
export async function POST(req:Request){
  try{
    const body=await req.json(); const {projectId,timeline}=body; const projects=await load(); const project=projects.find((x:any)=>x.id===projectId)
    if(!project) return NextResponse.json({error:'Project not found.'},{status:404})
    const manifest=buildRenderManifest(projectId,project.plan,timeline||project.plan.timeline,body.outputOptions)
    return NextResponse.json({manifest})
  }catch(e:any){return NextResponse.json({error:e.message||'Could not prepare render.'},{status:400})}
}
