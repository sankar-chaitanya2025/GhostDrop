-- Migration: 0005_unlock_authorizations.sql
-- Implements unlock_authorizations (ARCHITECTURE.md §3.1, §6.2, R01, R17)

CREATE TABLE IF NOT EXISTS unlock_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ghost_recipient_id UUID NOT NULL REFERENCES ghost_recipients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '60 seconds'),
    CONSTRAINT chk_unlock_auth_ttl CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_unlock_auth_valid ON unlock_authorizations(id) WHERE is_redeemed = FALSE;

-- RLS: Zero direct client access. Edge Functions redeem unlock authorizations.
ALTER TABLE unlock_authorizations ENABLE ROW LEVEL SECURITY;
