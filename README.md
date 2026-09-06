# AI Film Studio — V43

Production-oriented AI Film Studio for generating actual moving AI video, continuity-aware production, natural voice, audio mastering, AI editing, long-form rendering and YouTube packaging.

**Runtime baseline:** Node.js 24+. Next.js 16.3.3.

## V28 — Production Operations

V28 adds protected operational status, deployment preflight, and a Dockerized independent FFmpeg render-worker kit.

# AI Film Studio V14

V14 adds true visual QC for generated moving footage. Completed shots can be sampled with FFmpeg and analyzed by a multimodal vision model through AI Gateway for character consistency, environment continuity, temporal stability, realism, composition, motion quality and visual artifacts.

## Local
```bash
npm install
npm run dev
```

## Production environment
- `AI_GATEWAY_API_KEY`
- `VISUAL_QC_MODEL` (default `google/gemini-2.5-pro`)
- `GEMINI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `DATABASE_URL`
- render worker variables from V13

Deep QC requires FFmpeg and a reachable generated video URI. If unavailable, the system returns an explicit heuristic-fallback result rather than pretending the footage was visually inspected.

## V15 automatic shot repair
When Deep Visual QC marks a shot `regenerate`, AI Film Studio can automatically ask the AI Director to repair the generation prompt, preserving the Character/World context and story intent, then regenerate the actual moving footage. Automatic repair is capped at three attempts per shot and uncertain/fallback QC does not trigger silent replacement.

## V16 — Character & World Continuity
Every shot can now carry a first-class continuity state derived from the project Character/World information and previous shot. Video generation automatically receives this continuity lock when project/shot coordinates are supplied.


V17 adds durable character identity reference images and automatic reference-image injection into video generation.

## V21
V21 adds temporal continuity QC across adjacent generated shots, continuity drift metrics, transition quality, and richer continuity locks.

## V23
Production-grade audio mastering: dynamic narration ducking, per-stem fades/gain, LUFS normalization, true-peak limiting, 48 kHz / AAC delivery, and project-aware mastering configuration.

## V24 additions
- Full long-film production queue with bounded parallel shot generation (1–5 concurrent operations).
- Resumable shot-level production state and Neon `production_jobs` persistence.
- Automatic polling/fill of provider operations without holding HTTP requests open.
- Hero-shot priority scheduling.
- Automatic generated-video persistence to Blob when configured.
- Restored V22 performance/lip-sync planning and performance directives in video generation.
- Fixed production-master limiter to use FFmpeg amplitude units for a -1.5 dBTP ceiling.


## V25
Professional final render/export and YouTube publishing package are included. See V25.md.

## V27 — Production readiness
- Health endpoint: `/api/health`
- Readiness endpoint: `/api/ready`
- Security headers via `proxy.ts`
- Neon baseline migration: `migrations/001_initial.sql`
- Production config check: `npm run verify:production`
- HTTP smoke test: `npm run smoke` (set `SMOKE_BASE_URL` when testing a deployed URL)
- Set `DB_AUTO_MIGRATE=0` after applying the SQL migration in hardened production environments.
- `RENDER_WORKER_SECRET` protects render-worker callbacks when configured.


## V43 persistence hardening

Production deployments require `DATABASE_URL` for durable project persistence. The app no longer writes project data to the server filesystem when `NODE_ENV=production`. If the database is missing or unavailable, project APIs return an explicit 503 configuration/database error instead of silently failing or pretending a project was saved.


## V43 production diagnostics
The Production Queue exposes per-shot provider errors and supports retrying failed shots. If all shots fail with the same message, use that exact message to correct the Vercel/provider configuration before retrying.
