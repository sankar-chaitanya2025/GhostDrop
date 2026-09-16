# T12: Deduplicated Notification Outbox Worker

**What to build:** Notification outbox schema (`notification_outbox`), device push token mapping (`device_push_tokens`), and outbox worker state machine. Enforces at-least-once push notification delivery with unique event deduplication keys (`deduplication_key`), worker crash recovery with 30s leases, and multi-device push token fanout (ARCHITECTURE.md §3.1, §11.1, C15, H18, R10, R11).

**Blocked by:** T06 (Ghost Dispatch & Mutual-Friend Authorization), T09 (Atomic Ghost Open & ViewSession).

**Status:** completed

## Acceptance Criteria
- [ ] Supabase SQL migration creates `device_push_tokens` and `notification_outbox` tables with unique deduplication constraints.
- [ ] Notification module (`packages/shared/src/notification.ts`) formats deduplication keys and manages lease-claimed outbox worker transitions.
- [ ] Test verifies that duplicate domain events map to identical deduplication keys and avoid redundant pushes.
- [ ] Test verifies multi-device push fanout across all active enrolled devices for a user.
