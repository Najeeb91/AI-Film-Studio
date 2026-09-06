const base=process.env.SMOKE_BASE_URL||'http://localhost:3000'
const paths=['/api/health','/api/ready','/api/media/health']
let failed=false
for(const p of paths){try{const r=await fetch(base+p);const text=await r.text();console.log(`${r.status} ${p} ${text.slice(0,180)}`);if(p==='/api/health'&&!r.ok)failed=true}catch(e){console.error(`FAIL ${p}: ${e.message}`);failed=true}}
if(failed)process.exit(1)
console.log('Smoke test: PASS')
