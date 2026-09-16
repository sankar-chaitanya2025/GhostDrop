# T06: Ghost Dispatch & Mutual-Friend Authorization

**What to build:** Core message dispatch migrations (`ghosts`, `ghost_recipients`, `user_relationships`, `idempotency_records`) and dispatch domain logic. Enforces mutual friend acceptance before dispatch (`relationship_status = 'ACCEPTED'`), blocks abusive/blocked recipients, calculates unopened expiration deadlines, and validates idempotency keys (ARCHITECTURE.md §3.1, §8.1, §14.1).

**Blocked by:** T04 (Spatial Geofence & Velocity Engine), T05 (Media Staging & Storage Saga).

**Status:** completed

## Acceptance Criteria
- [ ] Supabase SQL migration creates `ghosts`, `ghost_recipients`, `user_relationships`, and `idempotency_records` tables with constraints and RLS.
- [ ] Dispatch validation module (`packages/shared/src/dispatch.ts`) validates sender-recipient authorization (blocks non-friends, rejects blocked users).
- [ ] Idempotency record validator ensures identical retry payloads receive cached results and conflicting payloads return `409 IDEMPOTENCY_CONFLICT`.
- [ ] Automated tests verify dispatch constraint checks, expiry calculations, and friend authorization.
