# T09: Atomic Ghost Open, Row Lock Hierarchy & ViewSession

**What to build:** View sessions schema (`view_sessions`) and atomic open state machine. Implements canonical row locking hierarchy (`ghosts` first, then `ghost_recipients`), single-use `UnlockAuthorization` burning, immutable `decay_expires_at` calculation, and `max_views` multi-view enforcement (ARCHITECTURE.md §3.1, §4.2, §4.4, §7.3, R03, R08, R09, R25).

**Blocked by:** T08 (Short-Lived UnlockAuthorization Issuance).

**Status:** completed

## Acceptance Criteria
- [ ] Supabase SQL migration creates `view_sessions` table with strict TTL/status checks and 0-client RLS.
- [ ] Open state machine module (`packages/shared/src/open.ts`) simulates atomic CAS transition from `UNLOCKABLE` to `OPENED_DECAYING`.
- [ ] Enforces `max_views` limits (1, 2, or 3) and creates discrete `ViewSession` records.
- [ ] Concurrency tests verify that parallel open attempts result in exactly 1 successful state advancement and 0 deadlocks.
