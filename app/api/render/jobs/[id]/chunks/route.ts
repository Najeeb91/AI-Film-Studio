import {NextResponse} from 'next/server'
import {databaseEnabled,ensureDatabase,listRenderChunks} from '@/lib/db'
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;if(!databaseEnabled)return NextResponse.json({chunks:[]});await ensureDatabase();return NextResponse.json({chunks:await listRenderChunks(id)})}
