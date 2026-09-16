-- Migration: 0001_core_identity.sql
-- Implements Users, Devices, Sessions from ARCHITECTURE.md §3.1 and §14 RLS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username CITEXT UNIQUE NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    account_status TEXT NOT NULL DEFAULT 'ACTIVE' 
        CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'TOMBSTONED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 2. Devices Table (Resolves R14)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    device_identifier TEXT NOT NULL,
    public_key TEXT NOT NULL, -- Ed25519 public key in Base64 or Hex
    platform TEXT NOT NULL CHECK (platform IN ('IOS', 'ANDROID')),
    os_version TEXT NOT NULL,
    app_version TEXT NOT NULL,
    device_status TEXT NOT NULL DEFAULT 'ACTIVE' 
        CHECK (device_status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_user_device UNIQUE(user_id, device_identifier)
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- 3. Sessions Table (Resolves R15)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash TEXT UNIQUE NOT NULL,
    session_status TEXT NOT NULL DEFAULT 'ACTIVE' 
        CHECK (session_status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    last_seq_num BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_seq_num_positive CHECK (last_seq_num >= 0)
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id);

-- Row Level Security (RLS) - ARCHITECTURE.md §14
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users RLS
CREATE POLICY users_select_own ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_update_own ON users
    FOR UPDATE USING (auth.uid() = id);

-- Devices RLS
CREATE POLICY devices_select_own ON devices
    FOR SELECT USING (auth.uid() = user_id);

-- Sessions RLS
CREATE POLICY sessions_select_own ON sessions
    FOR SELECT USING (auth.uid() = user_id);
