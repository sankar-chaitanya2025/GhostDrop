export type NotificationEventType =
  | 'GHOST_DISPATCHED'
  | 'PERIMETER_ENTERED'
  | 'GHOST_OPENED'
  | 'GHOST_REVOKED'
  | 'GHOST_EXPIRED';

export interface NotificationOutboxRecord {
  id: string;
  deduplicationKey: string;
  recipientUserId: string;
  eventType: NotificationEventType;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'DEAD_LETTER';
  attemptCount: number;
  workerId?: string;
  leaseUntilMs?: number;
}

export interface DevicePushTokenRecord {
  deviceId: string;
  userId: string;
  pushProvider: 'EXPO' | 'APNS' | 'FCM';
  tokenValue: string;
  isValid: boolean;
}

export const NOTIFICATION_LEASE_DURATION_MS = 30 * 1000; // 30s lease

/**
 * Creates deterministic event deduplication keys to prevent duplicate push dispatch (ARCHITECTURE.md §11.1, R10).
 */
export function formatDeduplicationKey(
  eventType: NotificationEventType,
  recipientUserId: string,
  aggregateId: string
): string {
  return `${eventType}:${recipientUserId}:${aggregateId}`;
}

/**
 * Resolves push notification targets across all active, valid devices enrolled by the user (Resolves H18).
 */
export function fanoutPushTargets(
  recipientUserId: string,
  userTokens: DevicePushTokenRecord[]
): string[] {
  return userTokens
    .filter((token) => token.userId === recipientUserId && token.isValid)
    .map((token) => token.tokenValue);
}

/**
 * Evaluates whether an outbox job is claimable.
 */
export function canClaimNotificationJob(job: NotificationOutboxRecord, nowMs: number): boolean {
  if (job.status === 'SENT' || job.status === 'DEAD_LETTER') {
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
 * Claims a notification job with a 30-second lease.
 */
export function claimNotificationJob(
  job: NotificationOutboxRecord,
  workerId: string,
  nowMs: number
): NotificationOutboxRecord {
  return {
    ...job,
    status: 'PROCESSING',
    workerId,
    attemptCount: job.attemptCount + 1,
    leaseUntilMs: nowMs + NOTIFICATION_LEASE_DURATION_MS,
  };
}
