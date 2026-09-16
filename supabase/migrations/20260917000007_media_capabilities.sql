-- Migration: 0007_media_capabilities.sql
-- Implements media_capabilities (ARCHITECTURE.md §3.1, §5.3, R02, R12)

CREATE TABLE IF NOT EXISTS media_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_session_id UUID NOT NULL REFERENCES view_sessions(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    capability_token TEXT UNIQUE NOT NULL,
    is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '30 seconds')
);
CREATE INDEX IF NOT EXISTS idx_media_capabilities_token ON media_capabilities(capability_token) WHERE is_redeemed = FALSE;

-- RLS: Zero direct client access. Edge Functions redeem media capabilities.
ALTER TABLE media_capabilities ENABLE ROW LEVEL SECURITY;
