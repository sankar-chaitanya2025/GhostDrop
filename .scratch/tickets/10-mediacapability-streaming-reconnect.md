# T10: Single-Use MediaCapability Streaming & Reconnection

**What to build:** Media capabilities schema (`media_capabilities`) and single-use streaming token engine. Replaces static 60s signed URLs with a single-use 30s token bound to `view_session_id`. Enables HTTP range requests while burning capability on initial transfer, and provides capability refreshing for network reconnection without re-burning view counts (ARCHITECTURE.md §3.1, §5.3, §8.5, R02, R12, R24).

**Blocked by:** T09 (Atomic Ghost Open & ViewSession).

**Status:** completed

## Acceptance Criteria
- [ ] Supabase SQL migration creates `media_capabilities` table with token indexes, 30s TTL, and 0-client RLS.
- [ ] Capability authorization module (`packages/shared/src/capability.ts`) implements token generation, atomic burn validation, and session-bound refresh logic.
- [ ] Concurrency test verifies that replaying a burned capability token fails (`403 FORBIDDEN_CAPABILITY`).
- [ ] Reconnection test verifies that calling refresh capability during an active `ViewSession` issues a new token without exceeding max views.
