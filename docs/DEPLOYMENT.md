# AI Film Studio V28 Deployment

Deploy the Next.js app to a **new dedicated Vercel project**. Never connect this app to the existing PumpOS repository/project.

Required production variables:
- AI_GATEWAY_API_KEY
- GEMINI_API_KEY
- BLOB_READ_WRITE_TOKEN
- DATABASE_URL
- RENDER_WORKER_URL
- RENDER_WORKER_SECRET

Recommended: APP_URL, USE_RENDER_WORKFLOW=1, REQUIRE_DURABLE_MEDIA=1, DB_AUTO_MIGRATE=0 after applying `migrations/001_initial.sql`, and a separate OPS_STATUS_SECRET.

## Worker
Build `docker/render-worker.Dockerfile` and run with `docker-compose.worker.yml`. The worker requires FFmpeg and the same `RENDER_WORKER_SECRET` configured by the web app.

## Verification
`npm ci` → `npm run preflight` → `npm run build` → `npm run start` → `SMOKE_BASE_URL=https://<deployment> npm run smoke` → authenticated `/api/ops/status` → real 8-second video → natural voice → short end-to-end render → multi-shot queue test.
