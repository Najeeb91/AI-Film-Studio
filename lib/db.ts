import { neon } from '@neondatabase/serverless'

export const databaseEnabled = Boolean(process.env.DATABASE_URL)
const sql = databaseEnabled ? neon(process.env.DATABASE_URL!) : null

export async function ensureDatabase(){
  if(!sql) return false
  if(process.env.DB_AUTO_MIGRATE==='0') return true
  await sql`CREATE TABLE IF NOT EXISTS film_projects (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`
  await sql`CREATE TABLE IF NOT EXISTS render_jobs (id text PRIMARY KEY, project_id text NOT NULL, status text NOT NULL, progress integer NOT NULL DEFAULT 0, manifest jsonb NOT NULL, output_uri text, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`
  await sql`CREATE TABLE IF NOT EXISTS media_assets (id text PRIMARY KEY, project_id text, kind text NOT NULL, uri text NOT NULL, mime_type text, size_bytes bigint, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`
  await sql`CREATE TABLE IF NOT EXISTS production_jobs (id text PRIMARY KEY, project_id text NOT NULL, shot_id text NOT NULL, chapter_index integer NOT NULL, scene_index integer NOT NULL, shot_index integer NOT NULL, status text NOT NULL, priority integer NOT NULL DEFAULT 50, attempts integer NOT NULL DEFAULT 0, operation_name text, provider text, model text, error text, created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id, shot_id))`
  await sql`CREATE TABLE IF NOT EXISTS render_chunks (id text PRIMARY KEY, render_job_id text NOT NULL REFERENCES render_jobs(id) ON DELETE CASCADE, chunk_index integer NOT NULL, start_seconds double precision NOT NULL, duration_seconds double precision NOT NULL, status text NOT NULL DEFAULT 'queued', progress integer NOT NULL DEFAULT 0, uri text, error text, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(render_job_id, chunk_index))`
  return true
}

export async function upsertProject(id:string,data:any){
  if(!sql) return false
  await sql`INSERT INTO film_projects(id,data) VALUES(${id},${JSON.stringify(data)}) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`
  return true
}

export async function listProjects(){
  if(!sql) return []
  const rows=await sql`SELECT data FROM film_projects ORDER BY updated_at DESC`
  return rows.map((r:any)=>r.data)
}

export async function getProject(id:string){
  if(!sql) return null
  const rows=await sql`SELECT data FROM film_projects WHERE id=${id} LIMIT 1`
  return rows[0]?.data ?? null
}

export async function createRenderJob(job:any){
  if(!sql) return false
  await sql`INSERT INTO render_jobs(id,project_id,status,progress,manifest,output_uri,error) VALUES(${job.id},${job.projectId},${job.status},${job.progress},${JSON.stringify(job.manifest)},${job.outputUri??null},${job.error??null})`
  return true
}

export async function updateRenderJob(id:string,patch:any){
  if(!sql) return false
  await sql`UPDATE render_jobs SET status=COALESCE(${patch.status??null},status), progress=COALESCE(${patch.progress??null},progress), output_uri=COALESCE(${patch.outputUri??null},output_uri), error=COALESCE(${patch.error??null},error), updated_at=now() WHERE id=${id}`
  return true
}

export async function getRenderJob(id:string){
  if(!sql) return null
  const rows=await sql`SELECT id,"project_id" as "projectId",status,progress,manifest,"output_uri" as "outputUri",error,"created_at" as "createdAt","updated_at" as "updatedAt" FROM render_jobs WHERE id=${id} LIMIT 1`
  return rows[0] ?? null
}

export async function insertMediaAsset(asset:any){
  if(!sql) return false
  await sql`INSERT INTO media_assets(id,project_id,kind,uri,mime_type,size_bytes,metadata) VALUES(${asset.id},${asset.projectId??null},${asset.kind},${asset.uri},${asset.mimeType??null},${asset.sizeBytes??null},${JSON.stringify(asset.metadata??{})}) ON CONFLICT(id) DO UPDATE SET uri=EXCLUDED.uri, metadata=EXCLUDED.metadata`
  return true
}

export async function upsertRenderChunk(chunk:any){
  if(!sql) return false
  await sql`INSERT INTO render_chunks(id,render_job_id,chunk_index,start_seconds,duration_seconds,status,progress,uri,error) VALUES(${chunk.id},${chunk.renderJobId},${chunk.chunkIndex},${chunk.startSeconds},${chunk.durationSeconds},${chunk.status},${chunk.progress??0},${chunk.uri??null},${chunk.error??null}) ON CONFLICT(render_job_id,chunk_index) DO UPDATE SET status=EXCLUDED.status,progress=EXCLUDED.progress,uri=COALESCE(EXCLUDED.uri,render_chunks.uri),error=EXCLUDED.error,updated_at=now()`
  return true
}
export async function listRenderChunks(jobId:string){
  if(!sql) return []
  return await sql`SELECT id,"render_job_id" as "renderJobId",chunk_index as "chunkIndex",start_seconds as "startSeconds",duration_seconds as "durationSeconds",status,progress,uri,error,"updated_at" as "updatedAt" FROM render_chunks WHERE render_job_id=${jobId} ORDER BY chunk_index`
}


export async function createProductionJobs(jobs:any[]){
  if(!sql) return false
  for(const j of jobs){
    await sql`INSERT INTO production_jobs(id,project_id,shot_id,chapter_index,scene_index,shot_index,status,priority,attempts) VALUES(${j.id},${j.projectId},${j.shotId},${j.chapterIndex},${j.sceneIndex},${j.shotIndex},${j.status},${j.priority??50},${j.attempts??0}) ON CONFLICT(project_id,shot_id) DO UPDATE SET status=EXCLUDED.status, priority=EXCLUDED.priority, attempts=EXCLUDED.attempts, operation_name=NULL, provider=NULL, model=NULL, error=NULL, started_at=NULL, completed_at=NULL, updated_at=now()`
  }
  return true
}

export async function listProductionJobs(projectId:string){
  if(!sql) return []
  return await sql`SELECT id,"project_id" as "projectId","shot_id" as "shotId",chapter_index as "chapterIndex",scene_index as "sceneIndex",shot_index as "shotIndex",status,priority,attempts,operation_name as "operationName",provider,model,error,"created_at" as "createdAt","started_at" as "startedAt","completed_at" as "completedAt","updated_at" as "updatedAt" FROM production_jobs WHERE project_id=${projectId} ORDER BY priority ASC, chapter_index, scene_index, shot_index`
}

export async function getProductionJob(id:string){
  if(!sql) return null
  const rows=await sql`SELECT id,"project_id" as "projectId","shot_id" as "shotId",chapter_index as "chapterIndex",scene_index as "sceneIndex",shot_index as "shotIndex",status,priority,attempts,operation_name as "operationName",provider,model,error,"created_at" as "createdAt","started_at" as "startedAt","completed_at" as "completedAt","updated_at" as "updatedAt" FROM production_jobs WHERE id=${id} LIMIT 1`
  return rows[0] ?? null
}

export async function updateProductionJob(id:string,patch:any){
  if(!sql) return false
  await sql`UPDATE production_jobs SET status=COALESCE(${patch.status??null},status), attempts=COALESCE(${patch.attempts??null},attempts), operation_name=COALESCE(${patch.operationName??null},operation_name), provider=COALESCE(${patch.provider??null},provider), model=COALESCE(${patch.model??null},model), error=${patch.error??null}, started_at=COALESCE(${patch.startedAt??null},started_at), completed_at=COALESCE(${patch.completedAt??null},completed_at), updated_at=now() WHERE id=${id}`
  return true
}
