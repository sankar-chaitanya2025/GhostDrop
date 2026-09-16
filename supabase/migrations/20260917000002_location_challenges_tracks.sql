-- Migration: 0002_location_challenges_tracks.sql
-- Implements location_challenges and session_location_tracks from ARCHITECTURE.md §3.1 & §14

-- 1. Location Challenges (Resolves R16)
CREATE TABLE IF NOT EXISTS location_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    challenge_nonce TEXT UNIQUE NOT NULL,
    is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '60 seconds')
);
CREATE INDEX IF NOT EXISTS idx_challenges_nonce ON location_challenges(challenge_nonce) WHERE is_redeemed = FALSE;

-- 2. Session Location Tracks (Ephemeral Velocity Baseline - Resolves C03, H08)
CREATE TABLE IF NOT EXISTS session_location_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    reported_accuracy_meters REAL NOT NULL,
    seq_num BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '15 minutes')
);
CREATE INDEX IF NOT EXISTS idx_loc_track_session ON session_location_tracks(session_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_loc_track_expiry ON session_location_tracks(expires_at);

-- Row Level Security (RLS) - ARCHITECTURE.md §14
ALTER TABLE location_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_location_tracks ENABLE ROW LEVEL SECURITY;

-- Zero direct client access policies: Only server service_role / edge functions execute challenge and track operations
-- Client SELECT / INSERT / UPDATE / DELETE are denied by default.
