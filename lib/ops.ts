import {databaseEnabled} from '@/lib/db'
import {neon} from '@neondatabase/serverless'
export async function getOpsStatus(){
  if(!databaseEnabled) return {database:'disabled',productionJobs:null,renderJobs:null,failedProductionJobs:null,failedRenderJobs:null}
  const sql=neon(process.env.DATABASE_URL!)
  const [p,r,pf,rf]=await Promise.all([
    sql`SELECT count(*)::int AS count FROM production_jobs`,sql`SELECT count(*)::int AS count FROM render_jobs`,
    sql`SELECT count(*)::int AS count FROM production_jobs WHERE status='failed'`,sql`SELECT count(*)::int AS count FROM render_jobs WHERE status='failed'`
  ])
  return {database:'ok',productionJobs:p[0]?.count??0,renderJobs:r[0]?.count??0,failedProductionJobs:pf[0]?.count??0,failedRenderJobs:rf[0]?.count??0}
}
