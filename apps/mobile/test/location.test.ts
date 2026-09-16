import { describe, it, expect } from 'vitest';
import { generateDeviceKeyPair, verifyRequestSignature, hashPayload } from '@ghostdrop/shared';
import {
  prepareSignedObservationPayload,
  applyVerificationSuccess,
  evaluateUnlockAuthorizationState,
} from '../src/location.js';

describe('Client GPS Verification Loop (ARCHITECTURE.md §6.2, R01, R14)', () => {
  const { publicKey, privateKey } = generateDeviceKeyPair();

  it('prepares and cryptographically signs client location telemetry', () => {
    const now = Date.now();
    const observation = {
      ghostId: 'g_1',
      coords: { latitude: 37.7597, longitude: -122.4271 },
      accuracyMeters: 4.5,
    };

    const { payload, signature } = prepareSignedObservationPayload(
      observation,
      'cn_challenge_123',
      42,
      privateKey,
      now
    );

    expect(payload.ghost_id).toBe('g_1');
    expect(signature).toBeDefined();

    // Verify signature against public key
    const isValid = verifyRequestSignature(
      publicKey,
      {
        timestamp: now,
        nonce: 'cn_challenge_123',
        seqNum: 42,
        payloadHash: hashPayload(payload),
      },
      signature
    );
    expect(isValid).toBe(true);
  });

  it('manages 60-second unlock authorization countdown and auto re-locks upon expiration', () => {
    const now = Date.now();
    const exactCoords = { latitude: 37.7597, longitude: -122.4271 };

    // 1. Success verification -> UNLOCKABLE
    const unlockState = applyVerificationSuccess('g_1', 'ua_123', exactCoords, now + 60000);
    expect(unlockState.status).toBe('UNLOCKABLE');
    expect(unlockState.unlockAuthId).toBe('ua_123');

    // 2. Active countdown (30s later) -> remains UNLOCKABLE
    const activeState = evaluateUnlockAuthorizationState(unlockState, now + 30000);
    expect(activeState.status).toBe('UNLOCKABLE');

    // 3. User leaves or delays (> 60s) -> automatically reverts to LOCKED
    const expiredState = evaluateUnlockAuthorizationState(unlockState, now + 61000);
    expect(expiredState.status).toBe('LOCKED');
    expect(expiredState.unlockAuthId).toBeNull();
  });
});
