import {NextResponse} from 'next/server'
import {runShotQC} from '@/lib/qc'

export async function POST(req:Request){
 try{
  const {plan,chapterIndex,sceneIndex,shotIndex}=await req.json()
  if(!plan || chapterIndex===undefined || sceneIndex===undefined || shotIndex===undefined) return NextResponse.json({error:'Plan and shot coordinates are required.'},{status:400})
  const qualityCheck=runShotQC(plan,Number(chapterIndex),Number(sceneIndex),Number(shotIndex))
  return NextResponse.json({qualityCheck})
 }catch(e:any){return NextResponse.json({error:e?.message||'Quality check failed.'},{status:500})}
}
