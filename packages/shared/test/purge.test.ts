import { describe, it, expect } from 'vitest';
import {
  evaluatePurgeJobsForGhost,
  canClaimPurgeJob,
  claimPurgeJob,
  PURGE_LEASE_DURATION_MS,
  type PurgeJobRecord,
} from '../src/index.js';

describe('Ephemeral Purge Saga & Multi-Recipient Invariant (ARCHITECTURE.md §4.3, §10.1, R05, R06, R23)', () => {
  const ghostId = 'g_100';
  const assets = [
    { id: 'a_text', assetType: 'TEXT_NOTE' as const, vaultPath: null },
    { id: 'a_photo', assetType: 'PHOTO' as const, vaultPath: 'vault/g_100/photo.jpg' },
  ];

  it('enforces multi-recipient survival: does NOT purge while any recipient is non-terminal', () => {
    // Recipient A decayed, but Recipient B is still approaching
    const jobs = evaluatePurgeJobsForGhost(ghostId, ['VIEWED_DECAYED', 'DISCOVERED_LOCKED'], assets);
    expect(jobs).toHaveLength(0);
  });

  it('enqueues purge jobs when 100% of recipients reach terminal states', () => {
    // Recipient A decayed, Recipient B expired unopened -> 100% terminal
    const jobs = evaluatePurgeJobsForGhost(ghostId, ['VIEWED_DECAYED', 'EXPIRED_UNOPENED'], assets);
    expect(jobs).toHaveLength(2);

    // TEXT_NOTE asset -> METADATA_ONLY, storagePath is null
    const textJob = jobs.find((j) => j.mediaAssetId === 'a_text');
    expect(textJob?.purgeKind).toBe('METADATA_ONLY');
    expect(textJob?.storagePath).toBeNull();

    // PHOTO asset -> OBJECT_AND_METADATA, storagePath defined
    const photoJob = jobs.find((j) => j.mediaAssetId === 'a_photo');
    expect(photoJob?.purgeKind).toBe('OBJECT_AND_METADATA');
    expect(photoJob?.storagePath).toBe('vault/g_100/photo.jpg');
  });

  it('manages worker lease recovery for crashed purge workers (R06)', () => {
    const now = Date.now();
    const job: PurgeJobRecord = {
      id: 'pj_1',
      mediaAssetId: 'a_photo',
      ghostId,
      storagePath: 'vault/g_100/photo.jpg',
      purgeKind: 'OBJECT_AND_METADATA',
      status: 'PENDING',
      attemptCount: 0,
    };

    // 1. Pending job is claimable
    expect(canClaimPurgeJob(job, now)).toBe(true);

    // 2. Worker 1 claims job
    const claimed = claimPurgeJob(job, 'worker_1', now);
    expect(claimed.status).toBe('PROCESSING');
    expect(claimed.workerId).toBe('worker_1');
    expect(claimed.leaseUntilMs).toBe(now + PURGE_LEASE_DURATION_MS);

    // 3. Active lease cannot be claimed by another worker
    expect(canClaimPurgeJob(claimed, now + 10000)).toBe(false);

    // 4. Worker 1 crashes. Time advances past 60s lease
    const crashedTime = now + PURGE_LEASE_DURATION_MS + 1000;
    expect(canClaimPurgeJob(claimed, crashedTime)).toBe(true);

    // 5. Worker 2 reclaims and retries
    const reclaimed = claimPurgeJob(claimed, 'worker_2', crashedTime);
    expect(reclaimed.workerId).toBe('worker_2');
    expect(reclaimed.attemptCount).toBe(2);
  });
});
