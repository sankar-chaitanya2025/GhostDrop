import {
  canPurgeGhost,
  type GhostRecipientState,
  type MediaAssetType,
  type PurgeKind,
} from './index.js';

export interface PurgeJobRecord {
  id: string;
  mediaAssetId: string;
  ghostId: string;
  storagePath: string | null;
  purgeKind: PurgeKind;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'DEAD_LETTER';
  attemptCount: number;
  workerId?: string;
  leaseUntilMs?: number;
}

export const PURGE_LEASE_DURATION_MS = 60 * 1000; // 60s lease

/**
 * Evaluates whether all linked recipients have reached canonical terminal states,
 * and if so, generates asset-centric purge jobs (ARCHITECTURE.md §4.3, §10.1, R05).
 */
export function evaluatePurgeJobsForGhost(
  ghostId: string,
  recipientStates: GhostRecipientState[],
  assets: Array<{ id: string; assetType: MediaAssetType; vaultPath: string | null }>
): PurgeJobRecord[] {
  if (!canPurgeGhost(recipientStates)) {
    return []; // Invariant: do NOT purge while any recipient is non-terminal
  }

  return assets.map((asset) => {
    const isText = asset.assetType === 'TEXT_NOTE';
    return {
      id: `pj_${crypto.randomUUID()}`,
      mediaAssetId: asset.id,
      ghostId,
      storagePath: isText ? null : asset.vaultPath,
      purgeKind: isText ? 'METADATA_ONLY' : 'OBJECT_AND_METADATA',
      status: 'PENDING',
      attemptCount: 0,
    };
  });
}

/**
 * Evaluates whether a worker can claim a purge job.
 * Handles initial pending state and lease expiration for crashed workers (R06).
 */
export function canClaimPurgeJob(job: PurgeJobRecord, nowMs: number): boolean {
  if (job.status === 'COMPLETED' || job.status === 'DEAD_LETTER') {
    return false;
  }
  if (job.status === 'PENDING') {
    return true;
  }
  if (job.status === 'PROCESSING' && job.leaseUntilMs && nowMs >= job.leaseUntilMs) {
    return true; // Lease expired -> reclaimable
  }
  return false;
}

/**
 * Claims a purge job with a 60-second lease.
 */
export function claimPurgeJob(job: PurgeJobRecord, workerId: string, nowMs: number): PurgeJobRecord {
  return {
    ...job,
    status: 'PROCESSING',
    workerId,
    attemptCount: job.attemptCount + 1,
    leaseUntilMs: nowMs + PURGE_LEASE_DURATION_MS,
  };
}
