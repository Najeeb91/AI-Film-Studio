import fs from 'node:fs'
import path from 'node:path'
const root=process.cwd(), requiredFiles=['package.json','next.config.ts','app/layout.tsx','app/api/health/route.ts','worker/render-worker.mjs','migrations/001_initial.sql']
let failed=false
console.log('AI Film Studio V42 deployment preflight')
for(const f of requiredFiles){const ok=fs.existsSync(path.join(root,f));console.log(`${ok?'OK ':'MISS'} ${f}`);if(!ok)failed=true}
const required=['AI_GATEWAY_API_KEY','GEMINI_API_KEY','BLOB_READ_WRITE_TOKEN','DATABASE_URL','RENDER_WORKER_URL','RENDER_WORKER_SECRET']
for(const key of required){const ok=Boolean(process.env[key]);console.log(`${ok?'SET ':'MISS'} ${key}`);if(!ok)failed=true}
if(process.env.NODE_ENV==='production' && process.env.APP_URL && !/^https:\/\//.test(process.env.APP_URL)) console.log('WARN APP_URL should use https:// in production')
console.log(`Node ${process.version}`)
const major=Number(process.versions.node.split('.')[0])
if(major < 24){ console.error('Node 24+ is required for the V42 deployment baseline.'); failed=true }
if(failed){console.error('V42 deployment preflight: FAILED');process.exit(1)}
console.log('V42 deployment preflight: PASS')
