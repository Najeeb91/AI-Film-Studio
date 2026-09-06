import {NextResponse} from 'next/server'
import {matchReferences} from '@/lib/reference-matcher'
import {getProject,upsertProject,databaseEnabled,ensureDatabase} from '@/lib/db'
import {readFile,writeFile} from 'fs/promises'
import path from 'path'
async function load(){try{return JSON.parse(await readFile(path.join(process.cwd(),'data','projects.json'),'utf8'))}catch{return []}}
async function save(x:any){await writeFile(path.join(process.cwd(),'data','projects.json'),JSON.stringify(x,null,2))}
export async function POST(req:Request){try{const b=await req.json();const projectId=String(b.projectId||'');const ci=Number(b.chapterIndex),si=Number(b.sceneIndex),shi=Number(b.shotIndex);if(!projectId)return NextResponse.json({error:'projectId is required.'},{status:400});let p:any;if(databaseEnabled){await ensureDatabase();p=await getProject(projectId)}else p=(await load()).find((x:any)=>x.id===projectId);if(!p)return NextResponse.json({error:'Project not found.'},{status:404});const manifest=matchReferences(p.plan,ci,si,shi,3);p.plan.chapters[ci].scenes[si].shots[shi].referenceManifest=manifest;if(databaseEnabled)await upsertProject(projectId,{...p,updatedAt:new Date().toISOString()});else{const ps=await load();const i=ps.findIndex((x:any)=>x.id===projectId);ps[i]=p;await save(ps)}return NextResponse.json({referenceManifest:manifest})}catch(e:any){return NextResponse.json({error:e?.message||'Reference matching failed.'},{status:500})}}
