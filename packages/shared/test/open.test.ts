import { describe, it, expect } from 'vitest';
import {
  executeAtomicGhostOpen,
  type GhostRecord,
  type GhostRecipientRecord,
} from '../src/index.js';

describe('Atomic Ghost Open & ViewSession Lifecycle (ARCHITECTURE.md §4.4, §7.3, R03, R08)', () => {
  const userId = 'u_1';
  const deviceId = 'd_1';
  const sessionId = 's_1';

  it('atomically opens ghost, sets immutable decay deadline, and creates ViewSession 1', () => {
    const now = Date.now();
    const ghost: GhostRecord = {
      id: 'g_1',
      expiresAtMs: now + 86400000,
      decayDurationSeconds: 600, // 10 min
      maxViews: 1,
      lifecycleState: 'ACTIVE',
    };

    const recipient: GhostRecipientRecord = {
      id: 'gr_1',
      ghostId: 'g_1',
      recipientId: userId,
      state: 'UNLOCKABLE',
      viewCount: 0,
      firstOpenedAtMs: null,
      decayExpiresAtMs: null,
    };

    const result = executeAtomicGhostOpen(ghost, recipient, userId, deviceId, sessionId, now);
    expect(result.success).toBe(true);
    expect(result.updatedRecipient?.state).toBe('OPENED_DECAYING');
    expect(result.updatedRecipient?.viewCount).toBe(1);
    expect(result.updatedRecipient?.decayExpiresAtMs).toBe(now + 600000);
    expect(result.newViewSession?.sessionStatus).toBe('ACTIVE');
    expect(result.newViewSession?.expiresAtMs).toBe(now + 600000);
  });

  it('enforces max_views = 1 by rejecting subsequent open attempts', () => {
    const now = Date.now();
    const ghost: GhostRecord = {
      id: 'g_1',
      expiresAtMs: now + 86400000,
      decayDurationSeconds: 600,
      maxViews: 1,
      lifecycleState: 'ACTIVE',
    };

    const recipientAlreadyViewed: GhostRecipientRecord = {
      id: 'gr_1',
      ghostId: 'g_1',
      recipientId: userId,
      state: 'OPENED_DECAYING',
      viewCount: 1, // Already reached max_views
      firstOpenedAtMs: now - 30000,
      decayExpiresAtMs: now + 570000,
    };

    const result = executeAtomicGhostOpen(ghost, recipientAlreadyViewed, userId, deviceId, sessionId, now);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('VIEW_LIMIT_EXHAUSTED');
  });

  it('supports max_views = 2 by permitting a second view session within decay window', () => {
    const now = Date.now();
    const ghost: GhostRecord = {
      id: 'g_1',
      expiresAtMs: now + 86400000,
      decayDurationSeconds: 600,
      maxViews: 2, // Allows 2 view sessions
      lifecycleState: 'ACTIVE',
    };

    const initialRecipient: GhostRecipientRecord = {
      id: 'gr_1',
      ghostId: 'g_1',
      recipientId: userId,
      state: 'UNLOCKABLE',
      viewCount: 0,
      firstOpenedAtMs: null,
      decayExpiresAtMs: null,
    };

    // First open
    const firstOpen = executeAtomicGhostOpen(ghost, initialRecipient, userId, deviceId, sessionId, now);
    expect(firstOpen.success).toBe(true);
    expect(firstOpen.updatedRecipient?.viewCount).toBe(1);

    // Second open 2 minutes later
    const secondOpen = executeAtomicGhostOpen(
      ghost,
      firstOpen.updatedRecipient!,
      userId,
      deviceId,
      sessionId,
      now + 120000
    );
    expect(secondOpen.success).toBe(true);
    expect(secondOpen.updatedRecipient?.viewCount).toBe(2);
    expect(secondOpen.newViewSession?.id).not.toBe(firstOpen.newViewSession?.id);

    // Third open -> rejected because view_count (2) >= max_views (2)
    const thirdOpen = executeAtomicGhostOpen(
      ghost,
      secondOpen.updatedRecipient!,
      userId,
      deviceId,
      sessionId,
      now + 240000
    );
    expect(thirdOpen.success).toBe(false);
    expect(thirdOpen.errorCode).toBe('VIEW_LIMIT_EXHAUSTED');
  });

  it('rejects open if parent ghost expired or decay timer ran out', () => {
    const now = Date.now();
    const expiredGhost: GhostRecord = {
      id: 'g_1',
      expiresAtMs: now - 1000, // Expired 1 second ago
      decayDurationSeconds: 600,
      maxViews: 1,
      lifecycleState: 'EXPIRED',
    };

    const recipient: GhostRecipientRecord = {
      id: 'gr_1',
      ghostId: 'g_1',
      recipientId: userId,
      state: 'UNLOCKABLE',
      viewCount: 0,
      firstOpenedAtMs: null,
      decayExpiresAtMs: null,
    };

    const result = executeAtomicGhostOpen(expiredGhost, recipient, userId, deviceId, sessionId, now);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('GHOST_EXPIRED');
  });
});
