import {NextResponse} from 'next/server'
import {readFile} from 'fs/promises'
import path from 'path'
import {buildYouTubePackage} from '@/lib/youtube-package'
import {databaseEnabled,ensureDatabase,getProject} from '@/lib/db'
const file=path.join(process.cwd(),'data','projects.json')
export async function POST(req:Request){try{const {projectId,timeline}=await req.json();let project:any;if(databaseEnabled){await ensureDatabase();project=await getProject(projectId)}else{const projects=JSON.parse(await readFile(file,'utf8'));project=projects.find((x:any)=>x.id===projectId)}if(!project)return NextResponse.json({error:'Project not found.'},{status:404});return NextResponse.json({package:buildYouTubePackage(project.plan,timeline||project.plan.timeline)})}catch(e:any){return NextResponse.json({error:e.message||'Could not build YouTube package.'},{status:400})}}
