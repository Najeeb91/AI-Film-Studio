import {NextResponse} from 'next/server'
import {readFile,writeFile} from 'fs/promises'
import path from 'path'
import {databaseEnabled,ensureDatabase,getProject,upsertProject} from '@/lib/db'
async function load(){try{return JSON.parse(await readFile(path.join(process.cwd(),'data','projects.json'),'utf8'))}catch{return []}}
async function save(x:any){await writeFile(path.join(process.cwd(),'data','projects.json'),JSON.stringify(x,null,2))}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const u=new URL(req.url);const projectId=u.searchParams.get('projectId');if(!projectId)return NextResponse.json({error:'projectId is required.'},{status:400});let p:any;if(databaseEnabled){await ensureDatabase();p=await getProject(projectId)}else p=(await load()).find((x:any)=>x.id===projectId);if(!p)return NextResponse.json({error:'Project not found.'},{status:404});p.plan.references=(p.plan.references||[]).filter((r:any)=>r.id!==id);for(const c of p.plan.characters||[])c.referenceImages=(c.referenceImages||[]).filter((r:any)=>r.id!==id);if(databaseEnabled)await upsertProject(projectId,{...p,updatedAt:new Date().toISOString()});else{const ps=await load();const i=ps.findIndex((x:any)=>x.id===projectId);ps[i]=p;await save(ps)}return NextResponse.json({ok:true})}
