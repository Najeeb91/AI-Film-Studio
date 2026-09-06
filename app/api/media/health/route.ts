import {NextResponse} from 'next/server'
export async function GET(){return NextResponse.json({blobConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN),databaseConfigured:Boolean(process.env.DATABASE_URL),renderWorkerConfigured:Boolean(process.env.RENDER_WORKER_URL),timestamp:new Date().toISOString()})}
