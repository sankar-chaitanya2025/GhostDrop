import { describe, it, expect } from 'vitest';
import {
  issueUnlockAuthorization,
  validateUnlockAuthorizationRedemption,
  UNLOCK_AUTHORIZATION_TTL_SECONDS,
} from '../src/index.js';

describe('UnlockAuthorization Issuance & Anti-Bypass (ARCHITECTURE.md §6.2, R01, R17)', () => {
  const userId = 'u_123';
  const deviceId = 'd_456';
  const sessionId = 's_789';
  const recipientId = 'gr_999';

  it('issues an authorization with strict 60s TTL', () => {
    const now = Date.now();
    const auth = issueUnlockAuthorization(recipientId, userId, deviceId, sessionId, now);

    expect(auth.id).toMatch(/^ua_/);
    expect(auth.isRedeemed).toBe(false);
    expect(auth.expiresAtMs - auth.createdAtMs).toBe(UNLOCK_AUTHORIZATION_TTL_SECONDS * 1000);
  });

  it('permits redemption within the 60-second window by matching session', () => {
    const now = Date.now();
    const auth = issueUnlockAuthorization(recipientId, userId, deviceId, sessionId, now);

    // 10 seconds later
    const result = validateUnlockAuthorizationRedemption(auth, userId, deviceId, sessionId, now + 10000);
    expect(result.valid).toBe(true);
  });

  it('rejects redemption after 60-second TTL expires (defeating location bypass)', () => {
    const now = Date.now();
    const auth = issueUnlockAuthorization(recipientId, userId, deviceId, sessionId, now);

    // 61 seconds later (user walked away)
    const result = validateUnlockAuthorizationRedemption(auth, userId, deviceId, sessionId, now + 61000);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('UNLOCK_AUTH_EXPIRED');
  });

  it('rejects redemption if authorization was already burned (single-use)', () => {
    const now = Date.now();
    const auth = issueUnlockAuthorization(recipientId, userId, deviceId, sessionId, now);
    auth.isRedeemed = true; // Burned on first open

    const result = validateUnlockAuthorizationRedemption(auth, userId, deviceId, sessionId, now + 5000);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('UNLOCK_AUTH_EXPIRED');
  });

  it('rejects redemption if requested from a different device or session', () => {
    const now = Date.now();
    const auth = issueUnlockAuthorization(recipientId, userId, deviceId, sessionId, now);

    const hijacked = validateUnlockAuthorizationRedemption(auth, userId, 'different_device', sessionId, now + 5000);
    expect(hijacked.valid).toBe(false);
    expect(hijacked.errorCode).toBe('SESSION_MISMATCH');
  });
});
