import { describe, it, expect } from 'vitest';
import {
  validateRecipientEligibility,
  validateCreateGhostParameters,
  evaluateIdempotency,
  hashPayload,
} from '../src/index.js';

describe('Ghost Dispatch & Recipient Authorization (ARCHITECTURE.md §3.1, §8.1, §14.1)', () => {
  it('permits dispatch only to mutual accepted friends', () => {
    // 1. Accepted friend -> allowed
    const accepted = validateRecipientEligibility('user_sender', 'user_recipient', {
      requesterId: 'user_sender',
      addresseeId: 'user_recipient',
      relationshipStatus: 'ACCEPTED',
    });
    expect(accepted.allowed).toBe(true);

    // 2. Blocked relationship -> forbidden
    const blocked = validateRecipientEligibility('user_sender', 'user_recipient', {
      requesterId: 'user_sender',
      addresseeId: 'user_recipient',
      relationshipStatus: 'BLOCKED',
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.errorCode).toBe('FORBIDDEN_RECIPIENT');

    // 3. No relationship record (stranger) -> forbidden
    const stranger = validateRecipientEligibility('user_sender', 'user_stranger', null);
    expect(stranger.allowed).toBe(false);
    expect(stranger.errorCode).toBe('FORBIDDEN_RECIPIENT');

    // 4. Cannot send to self
    const self = validateRecipientEligibility('user_1', 'user_1', null);
    expect(self.allowed).toBe(false);
  });

  it('validates ghost parameter boundaries and decay durations', () => {
    // Valid configuration
    const valid = validateCreateGhostParameters({
      senderId: 'u1',
      recipientId: 'u2',
      unlockRadiusMeters: 75,
      unopenedLifetimeSeconds: 86400,
      decayDurationSeconds: 600, // 10 min
      maxViews: 1,
    });
    expect(valid.valid).toBe(true);

    // Invalid radius (< 25m)
    const tooSmallRadius = validateCreateGhostParameters({
      senderId: 'u1',
      recipientId: 'u2',
      unlockRadiusMeters: 10,
      unopenedLifetimeSeconds: 86400,
      decayDurationSeconds: 600,
      maxViews: 1,
    });
    expect(tooSmallRadius.valid).toBe(false);
    expect(tooSmallRadius.error).toBe('INVALID_UNLOCK_RADIUS');

    // Invalid decay duration (450s is not in 300, 600, 900, 1800)
    const invalidDecay = validateCreateGhostParameters({
      senderId: 'u1',
      recipientId: 'u2',
      unlockRadiusMeters: 75,
      unopenedLifetimeSeconds: 86400,
      decayDurationSeconds: 450,
      maxViews: 1,
    });
    expect(invalidDecay.valid).toBe(false);
    expect(invalidDecay.error).toBe('INVALID_DECAY_DURATION');
  });

  it('manages request idempotency with cached replays and conflict detection', () => {
    const now = Date.now();
    const payload = { recipientId: 'u2', lat: 37.75, lng: -122.42 };
    const requestHash = hashPayload(payload);

    const storedRecord = {
      requestHash,
      responseStatus: 201,
      responseBody: { ghostId: 'ghost_123', status: 'ACTIVE' },
      expiresAtMs: now + 86400000,
    };

    // 1. Identical retry returns cached response
    const retryResult = evaluateIdempotency(storedRecord, payload, now);
    expect(retryResult.action).toBe('RETURN_CACHED');
    if (retryResult.action === 'RETURN_CACHED') {
      expect(retryResult.status).toBe(201);
      expect(retryResult.body).toEqual({ ghostId: 'ghost_123', status: 'ACTIVE' });
    }

    // 2. Different payload with same idempotency key triggers conflict rejection
    const conflictingPayload = { recipientId: 'u3', lat: 37.75, lng: -122.42 };
    const conflictResult = evaluateIdempotency(storedRecord, conflictingPayload, now);
    expect(conflictResult.action).toBe('REJECT_CONFLICT');
    if (conflictResult.action === 'REJECT_CONFLICT') {
      expect(conflictResult.errorCode).toBe('IDEMPOTENCY_CONFLICT');
    }

    // 3. Expired record allows proceeding
    const expiredResult = evaluateIdempotency(storedRecord, payload, now + 90000000);
    expect(expiredResult.action).toBe('PROCEED');
  });
});
