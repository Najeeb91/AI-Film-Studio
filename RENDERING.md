# AI Film Studio V9 — Durable Render Layer

V9 introduces a real render contract rather than a fake browser render.

## Render architecture

1. `POST /api/render/manifest` validates the project and creates a deterministic render manifest.
2. `POST /api/render/jobs` creates a resumable render job record.
3. A production worker should execute the manifest in chunks and persist progress.
4. `scripts/render-film.mjs` is the reference FFmpeg worker for local/self-hosted execution.
5. `scripts/render-srt.mjs` creates an SRT from the narration script.

The render manifest is provider-independent: video/audio providers only need to expose durable URIs. Temporary provider URLs should be copied into object storage before production rendering.

## Local render

```bash
node scripts/render-film.mjs manifest.json final-film.mp4
node scripts/render-srt.mjs manifest.json subtitles.srt
```

## Production

Use durable object storage for media and a durable workflow/worker for rendering. Vercel Workflows is the intended orchestration layer; its workflow/step model persists progress, retries isolated work and can survive deploys/crashes. Vercel Blob is the intended object-storage adapter for media URLs. The app must not render a 60-minute film inside a single request.
