# T05: Media Staging & Durable Storage Finalization Saga

**What to build:** Media asset schema (`media_assets`) and durable storage finalization queue (`storage_finalization_queue`). Implements file format & magic-byte validation, upload staging path generation, and the transactional outbox saga state machine with worker lease recovery (ARCHITECTURE.md §5.4, R04).

**Blocked by:** T02 (Device Enrollment & Ed25519 Request Signing).

**Status:** completed

## Acceptance Criteria
- [ ] Supabase SQL migration creates `media_assets` and `storage_finalization_queue` tables with lease columns (`lease_until`, `worker_id`, `attempt_count`).
- [ ] Pure media validation module (`packages/shared/src/media.ts`) validates JPEG, PNG, and AAC/M4A magic bytes and enforces size limits (10MB photo, 5MB audio).
- [ ] Storage finalization state machine simulates copy from staging to vault with worker crash recovery (leases expire and allow idempotent retries).
- [ ] Unit tests verify format validation, magic byte sniffing, and worker lease transitions.
