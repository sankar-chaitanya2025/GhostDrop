-- Migration: 0009_notification_outbox.sql
-- Implements device_push_tokens and notification_outbox (ARCHITECTURE.md §3.1, §11.1, C15, H18, R10, R11)

-- 1. Device Push Tokens Table (Resolves H18)
CREATE TABLE IF NOT EXISTS device_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID UNIQUE NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_provider TEXT NOT NULL CHECK (push_provider IN ('EXPO', 'APNS', 'FCM')),
    token_value TEXT NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON device_push_tokens(user_id) WHERE is_valid = TRUE;

-- 2. Notification Outbox Table (Resolves C15, R10, R11)
CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deduplication_key TEXT UNIQUE NOT NULL,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL 
        CHECK (event_type IN ('GHOST_DISPATCHED', 'PERIMETER_ENTERED', 'GHOST_OPENED', 'GHOST_REVOKED', 'GHOST_EXPIRED')),
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'DEAD_LETTER')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    worker_id UUID,
    lease_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_notif_outbox_ready ON notification_outbox(next_attempt_at) 
    WHERE status IN ('PENDING', 'PROCESSING');

-- RLS
ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- Device push token can be registered by own user
CREATE POLICY push_tokens_own ON device_push_tokens
    FOR ALL USING (auth.uid() = user_id);
