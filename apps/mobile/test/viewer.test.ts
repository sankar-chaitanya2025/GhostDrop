import { describe, it, expect } from 'vitest';
import {
  initializeViewerState,
  calculateRemainingDecayMs,
  handleAppBackgrounded,
  handleAppResumed,
  destroyViewerState,
} from '../src/viewer.js';

describe('High-Stakes Ephemeral Viewer & Memory Zeroing (ARCHITECTURE.md §13.1, §13.2, H11, H20)', () => {
  const ghostId = 'g_1';
  const viewSessionId = 'vs_1';
  const initialPayload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

  it('initializes viewer state and holds payload in volatile memory', () => {
    const now = Date.now();
    const state = initializeViewerState(ghostId, viewSessionId, now + 600000, initialPayload);

    expect(state.isBlurred).toBe(false);
    expect(state.isDecayed).toBe(false);
    expect(state.rawPayloadBuffer).toEqual(initialPayload);
  });

  it('calculates remaining decay duration with server clock skew correction', () => {
    const serverTime = 1000000;
    const decayExpiresAt = serverTime + 60000; // 60s remaining
    const clientTime = serverTime + 2000; // Client clock is 2 seconds fast
    const skew = clientTime - serverTime; // +2000ms

    const remaining = calculateRemainingDecayMs(decayExpiresAt, clientTime, skew);
    expect(remaining).toBe(60000); // Corrected to exactly 60s
  });

  it('blurs screen content on app backgrounding (protecting OS snapshots)', () => {
    const now = Date.now();
    const state = initializeViewerState(ghostId, viewSessionId, now + 600000, initialPayload);

    const backgrounded = handleAppBackgrounded(state);
    expect(backgrounded.isBlurred).toBe(true);
    expect(backgrounded.isDecayed).toBe(false);
  });

  it('automatically zeroes memory and marks decayed if decay expires while backgrounded', () => {
    const now = Date.now();
    const decayExpiresAt = now + 10000; // 10s decay remaining
    const state = initializeViewerState(ghostId, viewSessionId, decayExpiresAt, initialPayload);

    // App resumes 15s later (after decay has passed)
    const resumed = handleAppResumed(state, now + 15000);

    expect(resumed.isDecayed).toBe(true);
    expect(resumed.isBlurred).toBe(true);
    expect(resumed.rawPayloadBuffer).toBeNull();
  });

  it('explicitly zeroes and destroys memory buffer upon dismissal', () => {
    const now = Date.now();
    const buffer = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const state = initializeViewerState(ghostId, viewSessionId, now + 600000, buffer);

    const destroyed = destroyViewerState(state);
    expect(destroyed.isDecayed).toBe(true);
    expect(destroyed.rawPayloadBuffer).toBeNull();
    // Verify underlying buffer elements were overwritten with zeros
    expect(buffer.every((b) => b === 0)).toBe(true);
  });
});
