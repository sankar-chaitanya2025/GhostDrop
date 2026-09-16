import { describe, it, expect } from 'vitest';
import {
  validateMediaMagicBytes,
  canClaimStorageJob,
  claimStorageJob,
  MAX_PHOTO_SIZE_BYTES,
  STORAGE_LEASE_DURATION_MS,
  type StorageFinalizationJob,
} from '../src/index.js';

describe('Media Staging & Storage Saga (ARCHITECTURE.md §5.1, §5.4, R04, R06)', () => {
  it('identifies authentic JPEG magic bytes (FF D8 FF)', () => {
    const validJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const result = validateMediaMagicBytes('PHOTO', validJpeg);
    expect(result.valid).toBe(true);
  });

  it('identifies authentic PNG magic bytes (89 50 4E 47)', () => {
    const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const result = validateMediaMagicBytes('PHOTO', validPng);
    expect(result.valid).toBe(true);
  });

  it('rejects spoofed executables disguised as photos', () => {
    // Windows PE / Linux ELF executable header
    const executable = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    const result = validateMediaMagicBytes('PHOTO', executable);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_MAGIC_BYTES');
  });

  it('rejects photos exceeding 10MB size limit', () => {
    // Create oversized dummy buffer
    const oversized = new Uint8Array(MAX_PHOTO_SIZE_BYTES + 100);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;

    const result = validateMediaMagicBytes('PHOTO', oversized);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('FILE_TOO_LARGE');
  });

  it('identifies authentic AAC/M4A audio magic bytes', () => {
    const validM4A = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ...ftyp
    ]);
    const result = validateMediaMagicBytes('VOICE_NOTE', validM4A);
    expect(result.valid).toBe(true);
  });

  it('manages worker lease claims and crash recovery (R06)', () => {
    const now = Date.now();
    const job: StorageFinalizationJob = {
      id: 'job_1',
      mediaAssetId: 'asset_1',
      stagingPath: 'staging/u1/photo.jpg',
      vaultPath: 'vault/g1/photo.jpg',
      status: 'PENDING',
      attemptCount: 0,
    };

    // 1. Initial pending job is claimable
    expect(canClaimStorageJob(job, now)).toBe(true);

    // 2. Worker 1 claims job
    const claimedJob = claimStorageJob(job, 'worker_1', now);
    expect(claimedJob.status).toBe('PROCESSING');
    expect(claimedJob.workerId).toBe('worker_1');
    expect(claimedJob.attemptCount).toBe(1);
    expect(claimedJob.leaseUntilMs).toBe(now + STORAGE_LEASE_DURATION_MS);

    // 3. While lease is active, another worker cannot steal it
    expect(canClaimStorageJob(claimedJob, now + 10000)).toBe(false);

    // 4. Worker 1 crashes. Time advances past lease expiry (61 seconds later)
    const crashedTime = now + STORAGE_LEASE_DURATION_MS + 1000;
    expect(canClaimStorageJob(claimedJob, crashedTime)).toBe(true);

    // 5. Worker 2 recovers the job
    const recoveredJob = claimStorageJob(claimedJob, 'worker_2', crashedTime);
    expect(recoveredJob.workerId).toBe('worker_2');
    expect(recoveredJob.attemptCount).toBe(2);
  });
});
