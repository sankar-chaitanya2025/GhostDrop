import { describe, it, expect } from 'vitest';
import {
  generateChallengeNonce,
  validateChallengeRedemption,
  validateMonotonicSequence,
  CHALLENGE_TTL_MS,
  type LocationChallenge,
} from '../src/index.js';

describe('Location Challenge & Monotonic Sequence (ARCHITECTURE.md §6.2, R15, R16)', () => {
  it('generates unique cryptographic nonces', () => {
    const nonce1 = generateChallengeNonce();
    const nonce2 = generateChallengeNonce();
    expect(nonce1).toMatch(/^cn_[a-f0-9]{48}$/);
    expect(nonce2).toMatch(/^cn_[a-f0-9]{48}$/);
    expect(nonce1).not.toBe(nonce2);
  });

  it('validates fresh, unredeemed challenge', () => {
    const now = Date.now();
    const challenge: LocationChallenge = {
      id: 'ch_123',
      sessionId: 'sess_456',
      challengeNonce: generateChallengeNonce(),
      isRedeemed: false,
      createdAt: now,
      expiresAt: now + CHALLENGE_TTL_MS,
    };

    const result = validateChallengeRedemption(challenge, now + 1000);
    expect(result.valid).toBe(true);
  });

  it('rejects already redeemed challenge nonces', () => {
    const now = Date.now();
    const challenge: LocationChallenge = {
      id: 'ch_123',
      sessionId: 'sess_456',
      challengeNonce: generateChallengeNonce(),
      isRedeemed: true, // already burned
      createdAt: now - 5000,
      expiresAt: now + CHALLENGE_TTL_MS,
    };

    const result = validateChallengeRedemption(challenge, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('ALREADY_REDEEMED');
  });

  it('rejects expired challenge nonces', () => {
    const now = Date.now();
    const challenge: LocationChallenge = {
      id: 'ch_123',
      sessionId: 'sess_456',
      challengeNonce: generateChallengeNonce(),
      isRedeemed: false,
      createdAt: now - 65000,
      expiresAt: now - 5000, // expired 5 seconds ago
    };

    const result = validateChallengeRedemption(challenge, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });

  it('enforces strictly monotonic sequence progression', () => {
    // Valid: strictly increasing sequence
    expect(validateMonotonicSequence(1, 0).valid).toBe(true);
    expect(validateMonotonicSequence(15, 14).valid).toBe(true);
    expect(validateMonotonicSequence(100, 14).valid).toBe(true);

    // Invalid: replayed or equal sequence number
    const equalCheck = validateMonotonicSequence(14, 14);
    expect(equalCheck.valid).toBe(false);
    expect(equalCheck.error).toContain('REPLAYED_SEQUENCE');

    // Invalid: out-of-order sequence number
    const outOfOrderCheck = validateMonotonicSequence(10, 14);
    expect(outOfOrderCheck.valid).toBe(false);
    expect(outOfOrderCheck.error).toContain('REPLAYED_SEQUENCE');

    // Invalid format
    expect(validateMonotonicSequence(-1, 0).valid).toBe(false);
    expect(validateMonotonicSequence(0, 0).valid).toBe(false);
  });
});
