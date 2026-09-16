# T11: Ephemeral Purge Saga & Multi-Recipient Invariant

**What to build:** Asset-centric purge job queue (`purge_job_queue`), eligibility triggers, and the purge worker state machine. Enforces the canonical multi-recipient purge invariant: 100% of linked recipients must be in terminal states (`VIEWED_DECAYED`, `VIEW_LIMIT_REACHED`, `EXPIRED_UNOPENED`, `REVOKED`) before physical asset deletion. Differentiates `TEXT_NOTE` (metadata wipe) from binary assets (S3 unlinking + metadata wipe) and handles worker crash leases (ARCHITECTURE.md §3.1, §4.3, §10.1, §10.2, R05, R06, R07, R23).

**Blocked by:** T09 (Atomic Ghost Open & ViewSession), T10 (Single-Use MediaCapability Streaming).

**Status:** completed

## Acceptance Criteria
- [ ] Supabase SQL migration creates `purge_job_queue` table with worker lease columns (`lease_until`, `worker_id`) and 0-client RLS.
- [ ] Purge saga engine (`packages/shared/src/purge.ts`) implements multi-recipient purge eligibility evaluation and lease-claimed worker execution.
- [ ] Invariant test verifies that shared payloads survive while any recipient is non-terminal, and purge triggers only when all recipients reach terminal states.
- [ ] Worker lease test verifies that a crashed worker's job is safely reclaimed after 60s without duplicate corruption.
