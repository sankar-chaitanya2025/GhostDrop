-- Migration: 0003_media_staging_finalization.sql
-- Implements media_assets and storage_finalization_queue from ARCHITECTURE.md §3.1 & §5.4

-- 1. Media Assets Table (Resolves H03, H25, H26)
CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ghost_id UUID, -- Nullable initially during staging, linked on ghost create
    asset_type TEXT NOT NULL CHECK (asset_type IN ('TEXT_NOTE', 'PHOTO', 'VOICE_NOTE')),
    text_content TEXT,
    staging_storage_path TEXT,
    vault_storage_path TEXT,
    byte_size INTEGER,
    mime_type TEXT,
    sha256_checksum TEXT,
    lifecycle_state TEXT NOT NULL DEFAULT 'STAGED' 
        CHECK (lifecycle_state IN ('STAGED', 'ASSOCIATED', 'PURGE_PENDING', 'PURGED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    finalized_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_media_ghost ON media_assets(ghost_id);

-- 2. Storage Finalization Queue (Resolves R04, R06)
CREATE TABLE IF NOT EXISTS storage_finalization_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_asset_id UUID UNIQUE NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    ghost_id UUID,
    staging_path TEXT NOT NULL,
    vault_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD_LETTER')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    worker_id UUID,
    lease_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_stg_fin_ready ON storage_finalization_queue(next_attempt_at) 
    WHERE status IN ('PENDING', 'PROCESSING');

-- RLS: Private internal tables, 0 direct client access
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_finalization_queue ENABLE ROW LEVEL SECURITY;
