CREATE TABLE IF NOT EXISTS film_projects (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS render_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  manifest JSONB NOT NULL,
  output_uri TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  kind TEXT NOT NULL,
  uri TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS render_chunks (
  id TEXT PRIMARY KEY,
  render_job_id TEXT NOT NULL REFERENCES render_jobs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  start_seconds DOUBLE PRECISION NOT NULL,
  duration_seconds DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  uri TEXT,
  error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(render_job_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS render_jobs_project_idx ON render_jobs(project_id);
CREATE INDEX IF NOT EXISTS media_assets_project_idx ON media_assets(project_id);
CREATE INDEX IF NOT EXISTS render_chunks_job_idx ON render_chunks(render_job_id);


CREATE TABLE IF NOT EXISTS production_jobs (
  id text PRIMARY KEY, project_id text NOT NULL, shot_id text NOT NULL, chapter_index integer NOT NULL, scene_index integer NOT NULL, shot_index integer NOT NULL,
  status text NOT NULL, priority integer NOT NULL DEFAULT 50, attempts integer NOT NULL DEFAULT 0, operation_name text, provider text, model text, error text,
  created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id, shot_id)
);
