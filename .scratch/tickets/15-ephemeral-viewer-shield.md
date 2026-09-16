# T15: High-Stakes Screen-Shield Ephemeral Viewer

**What to build:** Client ephemeral viewing state machine (`apps/mobile/src/viewer.ts`). Manages volatile RAM texture buffering, memory zeroing on screen unmount, OS backgrounding blur, and live decay countdown synchronization against server deadlines (ARCHITECTURE.md §13.1, §13.2, H11, H20).

**Blocked by:** T10 (Single-Use MediaCapability Streaming), T14 (Client GPS Proximity & Verification Loop).

**Status:** completed

## Acceptance Criteria
- [ ] Viewer lifecycle controller (`apps/mobile/src/viewer.ts`) handles memory texture allocation, zeroing buffers on exit, and decay expiration auto-destruction.
- [ ] Synchronizes client visual countdown against server `decay_expires_at` using clock skew offset.
- [ ] Handles OS backgrounding: pauses and immediately blurs screen content; zeroes memory if decay expires while backgrounded.
- [ ] Automated tests verify memory scrubbing, countdown calculations, and backgrounding safety.
