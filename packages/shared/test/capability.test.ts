import { describe, it, expect } from 'vitest';
import {
  issueMediaCapability,
  validateAndBurnMediaCapability,
  refreshMediaCapability,
  MEDIA_CAPABILITY_TTL_SECONDS,
} from '../src/index.js';

describe('MediaCapability Streaming & Reconnection (ARCHITECTURE.md §5.3, §8.5, R02, R12)', () => {
  const viewSessionId = 'vs_123';
  const mediaAssetId = 'asset_456';

  it('issues a capability token with 30s TTL', () => {
    const now = Date.now();
    const cap = issueMediaCapability(viewSessionId, mediaAssetId, now);

    expect(cap.capabilityToken).toMatch(/^cap_[a-f0-9]{48}$/);
    expect(cap.isRedeemed).toBe(false);
    expect(cap.expiresAtMs - cap.createdAtMs).toBe(MEDIA_CAPABILITY_TTL_SECONDS * 1000);
  });

  it('validates and burns capability token on first streaming handshake', () => {
    const now = Date.now();
    const cap = issueMediaCapability(viewSessionId, mediaAssetId, now);

    // Initial stream connection
    const result = validateAndBurnMediaCapability(cap, now + 1000);
    expect(result.valid).toBe(true);

    // Atomically burn the token
    cap.isRedeemed = true;

    // Second stream connection attempt with same token -> rejected (Resolves C06)
    const replayAttempt = validateAndBurnMediaCapability(cap, now + 2000);
    expect(replayAttempt.valid).toBe(false);
    expect(replayAttempt.errorCode).toBe('FORBIDDEN_CAPABILITY');
  });

  it('rejects expired capability tokens (>30s)', () => {
    const now = Date.now();
    const cap = issueMediaCapability(viewSessionId, mediaAssetId, now);

    // 35 seconds later
    const result = validateAndBurnMediaCapability(cap, now + 35000);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('CAPABILITY_EXPIRED');
  });

  it('allows refreshing capability during active ViewSession after network disconnect (R12)', () => {
    const now = Date.now();
    const decayExpiresAtMs = now + 500000; // 500s remaining on decay

    const refresh = refreshMediaCapability(
      'ACTIVE',
      decayExpiresAtMs,
      viewSessionId,
      mediaAssetId,
      now + 15000
    );

    expect(refresh.success).toBe(true);
    expect(refresh.newCapability?.capabilityToken).toBeDefined();
    expect(refresh.newCapability?.isRedeemed).toBe(false);
  });

  it('rejects capability refresh if decay timer has expired or session was closed', () => {
    const now = Date.now();

    // 1. Decay timer expired
    const expiredDecay = refreshMediaCapability(
      'ACTIVE',
      now - 1000, // expired
      viewSessionId,
      mediaAssetId,
      now
    );
    expect(expiredDecay.success).toBe(false);
    expect(expiredDecay.errorCode).toBe('DECAY_EXPIRED');

    // 2. View session closed by user
    const closedSession = refreshMediaCapability(
      'CLOSED_BY_USER',
      now + 500000,
      viewSessionId,
      mediaAssetId,
      now
    );
    expect(closedSession.success).toBe(false);
    expect(closedSession.errorCode).toBe('VIEW_SESSION_CLOSED');
  });
});
