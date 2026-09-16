-- Migration: 0006_view_sessions.sql
-- Implements view_sessions (ARCHITECTURE.md §3.1, §4.4, R03, R25)

CREATE TABLE IF NOT EXISTS view_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ghost_recipient_id UUID NOT NULL REFERENCES ghost_recipients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    session_status TEXT NOT NULL DEFAULT 'ACTIVE' 
        CHECK (session_status IN ('ACTIVE', 'CLOSED_BY_USER', 'EXPIRED_BY_DECAY')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_view_sessions_recipient ON view_sessions(ghost_recipient_id);

-- RLS
ALTER TABLE view_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY view_sessions_select_own ON view_sessions
    FOR SELECT USING (auth.uid() = user_id);
