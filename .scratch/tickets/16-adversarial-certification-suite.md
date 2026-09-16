# T16: Full Adversarial Integration Certification Suite

**What to build:** Master integration and adversarial certification test suite (`packages/shared/test/adversarial-certification.test.ts`). Certifies the complete end-to-end lifecycle across the entire system specification (ARCHITECTURE.md §15, §16), validating R01 through R25 against:
1. Replay attacks with stale UnlockAuthorizations
2. Teleportation velocity baseline defense
3. Shared multi-recipient payload survival
4. Crash-recovery worker lease handling
5. Single-use capability token burning
6. Memory scrubbing and zeroing

**Blocked by:** T01 through T15.

**Status:** completed

## Acceptance Criteria
- [x] End-to-end adversarial test scenario 1: Location verified $\to$ 60s passes $\to$ open rejected.
- [x] End-to-end adversarial test scenario 2: Sender dispatches to Recipient A & B $\to$ A opens and finishes decay $\to$ payload preserved $\to$ B finishes decay $\to$ purge enqueued.
- [x] End-to-end adversarial test scenario 3: Media stream connection burns capability token $\to$ second connection rejected.
- [x] 100% of tests pass green across the monorepo.
