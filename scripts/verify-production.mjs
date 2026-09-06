const required=['AI_GATEWAY_API_KEY','GEMINI_API_KEY','BLOB_READ_WRITE_TOKEN','DATABASE_URL','RENDER_WORKER_URL']
let failed=false
console.log('AI Film Studio V27 production configuration check')
for(const key of required){const ok=Boolean(process.env[key]);console.log(`${ok?'OK ':'MISS'} ${key}`);if(!ok)failed=true}
console.log(`Node ${process.version}`)
if(failed){console.error('Production readiness: FAILED');process.exit(1)}
console.log('Production readiness: PASS')
