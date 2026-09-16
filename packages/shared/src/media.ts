import type { MediaAssetType } from './index.js';

export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VOICE_SIZE_BYTES = 5 * 1024 * 1024;  // 5MB
export const MAX_TEXT_NOTE_LENGTH = 500;

export interface MediaValidationResult {
  valid: boolean;
  errorCode?: 'FILE_TOO_LARGE' | 'INVALID_MAGIC_BYTES' | 'UNSUPPORTED_MIME_TYPE';
}

/**
 * Validates binary file magic numbers (signatures) to prevent executable spoofing.
 */
export function validateMediaMagicBytes(
  assetType: MediaAssetType,
  buffer: Uint8Array
): MediaValidationResult {
  if (buffer.length < 4) {
    return { valid: false, errorCode: 'INVALID_MAGIC_BYTES' };
  }

  if (assetType === 'PHOTO') {
    // Check max size
    if (buffer.length > MAX_PHOTO_SIZE_BYTES) {
      return { valid: false, errorCode: 'FILE_TOO_LARGE' };
    }

    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    // PNG: 89 50 4E 47
    const isPng =
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

    if (!isJpeg && !isPng) {
      return { valid: false, errorCode: 'INVALID_MAGIC_BYTES' };
    }
    return { valid: true };
  }

  if (assetType === 'VOICE_NOTE') {
    // Check max size
    if (buffer.length > MAX_VOICE_SIZE_BYTES) {
      return { valid: false, errorCode: 'FILE_TOO_LARGE' };
    }

    // AAC / M4A: ftypM4A or ftyp (bytes 4-7 equal 0x66 0x74 0x79 0x70)
    if (buffer.length >= 8) {
      const isM4A =
        buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
      if (isM4A) {
        return { valid: true };
      }
    }
    return { valid: false, errorCode: 'INVALID_MAGIC_BYTES' };
  }

  return { valid: true };
}

export interface StorageFinalizationJob {
  id: string;
  mediaAssetId: string;
  stagingPath: string;
  vaultPath: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'DEAD_LETTER';
  attemptCount: number;
  workerId?: string;
  leaseUntilMs?: number;
}

export const STORAGE_LEASE_DURATION_MS = 60 * 1000; // 60s lease

/**
 * Evaluates whether a worker can claim or reclaim a job (Resolves R06).
 */
export function canClaimStorageJob(job: StorageFinalizationJob, nowMs: number): boolean {
  if (job.status === 'COMPLETED' || job.status === 'DEAD_LETTER') {
    return false;
  }
  if (job.status === 'PENDING') {
    return true;
  }
  // If PROCESSING but lease has expired, job is reclaimable after worker crash
  if (job.status === 'PROCESSING' && job.leaseUntilMs && nowMs >= job.leaseUntilMs) {
    return true;
  }
  return false;
}

/**
 * Claims a job, setting status to PROCESSING with a 60-second lease.
 */
export function claimStorageJob(
  job: StorageFinalizationJob,
  workerId: string,
  nowMs: number
): StorageFinalizationJob {
  return {
    ...job,
    status: 'PROCESSING',
    workerId,
    attemptCount: job.attemptCount + 1,
    leaseUntilMs: nowMs + STORAGE_LEASE_DURATION_MS,
  };
}
