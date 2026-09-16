-- Migration: 0008_purge_job_queue.sql
-- Implements purge_job_queue (ARCHITECTURE.md §3.1, §4.3, §10.1, R05, R06, R07)

CREATE TABLE IF NOT EXISTS purge_job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    ghost_id UUID NOT NULL REFERENCES ghosts(id) ON DELETE CASCADE,
    storage_path TEXT, -- Null for TEXT_NOTE assets
    purge_kind TEXT NOT NULL CHECK (purge_kind IN ('OBJECT_AND_METADATA', 'METADATA_ONLY')),
    status TEXT NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD_LETTER')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    worker_id UUID,
    lease_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_purge_queue_ready ON purge_job_queue(next_attempt_at) 
    WHERE status IN ('PENDING', 'PROCESSING');

-- RLS: Internal queue, 0 direct client access
ALTER TABLE purge_job_queue ENABLE ROW LEVEL SECURITY;
