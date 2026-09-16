# T03: Location Challenge & Monotonic Sequence Enforcement

**What to build:** Location challenges schema and verification engine. Implements single-use 60s cryptographic challenge issuance (`location_challenges`), atomic challenge redemption, and strictly monotonic sequence counter verification on sessions (`sessions.last_seq_num`).

**Blocked by:** T02 (Device Enrollment & Ed25519 Request Signing).

**Status:** completed

## Acceptance Criteria
- [ ] Supabase SQL migration creates `location_challenges` and `session_location_tracks` tables with RLS and index optimizations from ARCHITECTURE.md §3.1.
- [ ] Pure verification module (`packages/shared/src/challenge.ts`) implements challenge generation, expiration checking, and atomic sequence comparison logic.
- [ ] Tests verify that replayed or out-of-order sequence numbers are rejected (`seq <= last_seq`).
- [ ] Tests verify that challenge nonces cannot be redeemed twice or after the 60-second window.
