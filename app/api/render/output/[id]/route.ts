import {NextResponse} from 'next/server'
import {readFile} from 'fs/promises'
import path from 'path'
import {databaseEnabled,ensureDatabase,getRenderJob} from '@/lib/db'
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params; if(databaseEnabled){await ensureDatabase();const job=await getRenderJob(id);if(job?.outputUri&&/^https?:\/\//i.test(job.outputUri)) return NextResponse.redirect(job.outputUri); if(!job)return NextResponse.json({error:'Rendered file not found.'},{status:404})} try{const buf=await readFile(path.join(process.cwd(),'data','renders',`${id}.mp4`));return new NextResponse(buf,{headers:{'Content-Type':'video/mp4','Content-Length':String(buf.byteLength),'Content-Disposition':`inline; filename="${id}.mp4"`}})}catch{return NextResponse.json({error:'Rendered file not found.'},{status:404})}}
