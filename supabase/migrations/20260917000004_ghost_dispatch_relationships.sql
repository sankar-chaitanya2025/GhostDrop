-- Migration: 0004_ghost_dispatch_relationships.sql
-- Implements ghosts, ghost_recipients, user_relationships, idempotency_records (ARCHITECTURE.md §3.1, §14)

-- 1. Ghosts Table (Root Spatial Drop Container - Resolves H01, H09, R21)
CREATE TABLE IF NOT EXISTS ghosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title TEXT,
    exact_location GEOGRAPHY(POINT, 4326) NOT NULL,
    obfuscated_location GEOGRAPHY(POINT, 4326) NOT NULL,
    location_hint TEXT NOT NULL,
    unlock_radius_meters INTEGER NOT NULL CHECK (unlock_radius_meters BETWEEN 25 AND 500),
    unopened_lifetime_seconds INTEGER NOT NULL CHECK (unopened_lifetime_seconds BETWEEN 3600 AND 604800),
    decay_duration_seconds INTEGER NOT NULL CHECK (decay_duration_seconds IN (300, 600, 900, 1800)),
    max_views INTEGER NOT NULL DEFAULT 1 CHECK (max_views BETWEEN 1 AND 3),
    lifecycle_state TEXT NOT NULL DEFAULT 'ACTIVE' 
        CHECK (lifecycle_state IN ('ACTIVE', 'CLOSING', 'EXPIRED', 'REVOKED', 'FULLY_CONSUMED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_expiry_calc CHECK (expires_at = created_at + (unopened_lifetime_seconds || ' seconds')::INTERVAL)
);
CREATE INDEX IF NOT EXISTS idx_ghosts_spatial ON ghosts USING GIST(exact_location);
CREATE INDEX IF NOT EXISTS idx_ghosts_expiry ON ghosts(expires_at) WHERE lifecycle_state IN ('ACTIVE', 'CLOSING');
CREATE INDEX IF NOT EXISTS idx_ghosts_sender ON ghosts(sender_id);

-- 2. Ghost Recipients Table (Resolves R01, R03, R22, R23)
CREATE TABLE IF NOT EXISTS ghost_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ghost_id UUID NOT NULL REFERENCES ghosts(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    state TEXT NOT NULL DEFAULT 'PENDING_DELIVERY' 
        CHECK (state IN ('PENDING_DELIVERY', 'DISCOVERED_LOCKED', 'UNLOCKABLE', 'OPENED_DECAYING', 'VIEWED_DECAYED', 'VIEW_LIMIT_REACHED', 'EXPIRED_UNOPENED', 'REVOKED')),
    view_count INTEGER NOT NULL DEFAULT 0,
    first_opened_at TIMESTAMPTZ,
    decay_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_ghost_recipient UNIQUE(ghost_id, recipient_id),
    CONSTRAINT chk_view_count_nonneg CHECK (view_count >= 0)
);
CREATE INDEX IF NOT EXISTS idx_gr_recipient_state ON ghost_recipients(recipient_id, state);
CREATE INDEX IF NOT EXISTS idx_gr_ghost_state ON ghost_recipients(ghost_id, state);
CREATE INDEX IF NOT EXISTS idx_gr_decay ON ghost_recipients(decay_expires_at) WHERE state = 'OPENED_DECAYING';

-- 3. User Relationships Table (Friends & Blocklist - Resolves H30, H31)
CREATE TABLE IF NOT EXISTS user_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_status TEXT NOT NULL CHECK (relationship_status IN ('ACCEPTED', 'BLOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_user_rel UNIQUE(requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_user_rel_lookup ON user_relationships(requester_id, addressee_id);

-- 4. Idempotency Records Table (Resolves C14, H28)
CREATE TABLE IF NOT EXISTS idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '24 hours'),
    CONSTRAINT uq_idempotency UNIQUE (user_id, device_id, endpoint, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_records(user_id, device_id, endpoint, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_records(expires_at);

-- RLS
ALTER TABLE ghosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;

-- Ghosts RLS: Sender can view own sent ghosts; Recipient can view assigned ghosts
CREATE POLICY ghosts_select_party ON ghosts
    FOR SELECT USING (
        auth.uid() = sender_id OR 
        EXISTS (SELECT 1 FROM ghost_recipients WHERE ghost_id = ghosts.id AND recipient_id = auth.uid())
    );

-- Relationships RLS
CREATE POLICY user_rel_select ON user_relationships
    FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
