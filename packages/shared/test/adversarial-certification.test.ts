import { describe, it, expect } from 'vitest';
import {
  // Crypto
  generateDeviceKeyPair,
  signRequestPayload,
  verifyRequestSignature,
  hashPayload,
  // Challenge & Sequence
  generateChallengeNonce,
  validateChallengeRedemption,
  validateMonotonicSequence,
  // Spatial & Velocity
  isWithinPerimeter,
  validateTelemetryQuality,
  evaluateVelocity,
  // Dispatch
  validateRecipientEligibility,
  validateCreateGhostParameters,
  evaluateIdempotency,
  // Obfuscation
  calculateObfuscatedLocation,
  classifyDistanceBand,
  // Unlock Authorization
  issueUnlockAuthorization,
  validateUnlockAuthorizationRedemption,
  // Open & ViewSession
  executeAtomicGhostOpen,
  // Media Capability
  issueMediaCapability,
  validateAndBurnMediaCapability,
  refreshMediaCapability,
  // Purge Saga
  evaluatePurgeJobsForGhost,
  canClaimPurgeJob,
  claimPurgeJob,
  // Notification Outbox
  formatDeduplicationKey,
  fanoutPushTargets,
  // Types
  type GhostRecord,
  type GhostRecipientRecord,
} from '../src/index.js';

describe('Ghost Drop 2.0 — Master Adversarial Certification Suite (ARCHITECTURE.md §15, §16, R01–R25)', () => {
  const senderId = 'user_sender_101';
  const recipientA = 'user_recipient_A';
  const recipientB = 'user_recipient_B';
  const ghostLocation = { latitude: 37.7597, longitude: -122.4271 }; // SF Dolores Park

  it('CERT-01: End-to-End UnlockAuthorization Anti-Bypass (R01, R17)', () => {
    const now = Date.now();
    const device = generateDeviceKeyPair();

    // 1. Recipient steps inside geofence perimeter (15m from pin, radius = 50m)
    const userLocation = { latitude: 37.7598, longitude: -122.4271 };
    const perimeterCheck = isWithinPerimeter(ghostLocation, userLocation, 50);
    expect(perimeterCheck.withinPerimeter).toBe(true);

    // 2. Server issues a 60-second single-use UnlockAuthorization
    const auth = issueUnlockAuthorization('gr_recip_A', recipientA, 'dev_1', 'sess_1', now);
    expect(auth.expiresAtMs - auth.createdAtMs).toBe(60000);

    // 3. User leaves perimeter and delays open by 65 seconds
    const delayedTime = now + 65000;
    const redemption = validateUnlockAuthorizationRedemption(auth, recipientA, 'dev_1', 'sess_1', delayedTime);

    // Assert: Stale authorization is strictly rejected
    expect(redemption.valid).toBe(false);
    expect(redemption.errorCode).toBe('UNLOCK_AUTH_EXPIRED');
  });

  it('CERT-02: End-to-End Multi-Recipient Payload Survival & Purge Sagas (R05, R23)', () => {
    const now = Date.now();
    const ghostId = 'g_master_200';
    const assets = [
      { id: 'asset_note', assetType: 'TEXT_NOTE' as const, vaultPath: null },
      { id: 'asset_pic', assetType: 'PHOTO' as const, vaultPath: 'vault/g_200/photo.jpg' },
    ];

    // State 1: Recipient A has completed decay, but Recipient B has not opened yet
    const stateA_decayed = ['VIEWED_DECAYED', 'DISCOVERED_LOCKED'] as const;
    const initialJobs = evaluatePurgeJobsForGhost(ghostId, [...stateA_decayed], assets);
    // Invariant: Zero purge jobs generated. Payload remains active for Recipient B!
    expect(initialJobs).toHaveLength(0);

    // State 2: Recipient B expires unopened -> 100% of recipients are now terminal
    const stateAllTerminal = ['VIEWED_DECAYED', 'EXPIRED_UNOPENED'] as const;
    const finalJobs = evaluatePurgeJobsForGhost(ghostId, [...stateAllTerminal], assets);

    // Invariant: Purge triggered. TEXT gets metadata wipe; PHOTO gets S3 deletion!
    expect(finalJobs).toHaveLength(2);
    expect(finalJobs.find((j) => j.mediaAssetId === 'asset_note')?.purgeKind).toBe('METADATA_ONLY');
    expect(finalJobs.find((j) => j.mediaAssetId === 'asset_pic')?.purgeKind).toBe('OBJECT_AND_METADATA');
  });

  it('CERT-03: End-to-End Single-Use MediaCapability Burn & Reconnection (R02, R12)', () => {
    const now = Date.now();
    const viewSessionId = 'vs_active_1';
    const mediaAssetId = 'asset_photo_1';
    const decayExpiresAtMs = now + 600000; // 10 min decay

    // 1. Initial capability token minted
    const capability = issueMediaCapability(viewSessionId, mediaAssetId, now);

    // 2. Initial stream connection consumes the token
    const streamHandshake = validateAndBurnMediaCapability(capability, now + 1000);
    expect(streamHandshake.valid).toBe(true);
    capability.isRedeemed = true; // Atomically burned

    // 3. Replay attack with same capability token fails
    const replayed = validateAndBurnMediaCapability(capability, now + 2000);
    expect(replayed.valid).toBe(false);
    expect(replayed.errorCode).toBe('FORBIDDEN_CAPABILITY');

    // 4. Client connection dropped midway: client calls refreshCapability
    const refreshed = refreshMediaCapability('ACTIVE', decayExpiresAtMs, viewSessionId, mediaAssetId, now + 5000);
    expect(refreshed.success).toBe(true);
    expect(refreshed.newCapability?.capabilityToken).toBeDefined();
    expect(refreshed.newCapability?.capabilityToken).not.toBe(capability.capabilityToken);
  });

  it('CERT-04: End-to-End Anti-Spoofing & Teleportation Velocity Envelope (C03, H14)', () => {
    const now = Date.now();
    const baselineTrack = {
      location: ghostLocation, // San Francisco
      recordedAtMs: now - 5000, // 5 seconds ago
    };

    // Adversary attempts GPS spoof to New York City (4,100 km in 5 seconds)
    const spoofedCoord = { latitude: 40.7128, longitude: -74.006 };
    const velocityCheck = evaluateVelocity(spoofedCoord, now, baselineTrack);

    expect(velocityCheck.passed).toBe(false);
    expect(velocityCheck.velocityMps).toBeGreaterThan(50000);
    expect(velocityCheck.shouldUpdateBaseline).toBe(false); // Baseline is NOT poisoned
  });

  it('CERT-05: Worker Crash Recovery & Saga Lease Execution (R06)', () => {
    const now = Date.now();
    const purgeJob = {
      id: 'pj_crash_test',
      mediaAssetId: 'a_1',
      ghostId: 'g_1',
      storagePath: 'vault/g_1/photo.jpg',
      purgeKind: 'OBJECT_AND_METADATA' as const,
      status: 'PENDING' as const,
      attemptCount: 0,
    };

    // Worker 1 claims job with 60s lease
    const claimedWorker1 = claimPurgeJob(purgeJob, 'worker_1', now);
    expect(claimedWorker1.workerId).toBe('worker_1');

    // Worker 1 crashes. After 61 seconds, Worker 2 reclaims and retries
    const crashedTime = now + 61000;
    expect(canClaimPurgeJob(claimedWorker1, crashedTime)).toBe(true);

    const claimedWorker2 = claimPurgeJob(claimedWorker1, 'worker_2', crashedTime);
    expect(claimedWorker2.workerId).toBe('worker_2');
    expect(claimedWorker2.attemptCount).toBe(2);
  });
});
