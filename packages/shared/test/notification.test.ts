import { describe, it, expect } from 'vitest';
import {
  formatDeduplicationKey,
  fanoutPushTargets,
  canClaimNotificationJob,
  claimNotificationJob,
  NOTIFICATION_LEASE_DURATION_MS,
  type NotificationOutboxRecord,
  type DevicePushTokenRecord,
} from '../src/index.js';

describe('Durable Notification Outbox & Push Fanout (ARCHITECTURE.md §3.1, §11.1, C15, H18, R10, R11)', () => {
  it('formats deterministic deduplication keys', () => {
    const key1 = formatDeduplicationKey('GHOST_DISPATCHED', 'user_100', 'ghost_200');
    const key2 = formatDeduplicationKey('GHOST_DISPATCHED', 'user_100', 'ghost_200');
    expect(key1).toBe('GHOST_DISPATCHED:user_100:ghost_200');
    expect(key1).toBe(key2); // Exact deduplication match
  });

  it('fans out push delivery to all active devices for a user (H18)', () => {
    const tokens: DevicePushTokenRecord[] = [
      { deviceId: 'dev_1', userId: 'user_A', pushProvider: 'EXPO', tokenValue: 'ExponentPushToken[111]', isValid: true },
      { deviceId: 'dev_2', userId: 'user_A', pushProvider: 'APNS', tokenValue: 'apns_token_222', isValid: true },
      { deviceId: 'dev_3', userId: 'user_A', pushProvider: 'FCM', tokenValue: 'fcm_token_333', isValid: false }, // Revoked device
      { deviceId: 'dev_4', userId: 'user_B', pushProvider: 'EXPO', tokenValue: 'ExponentPushToken[444]', isValid: true },
    ];

    const targets = fanoutPushTargets('user_A', tokens);
    expect(targets).toHaveLength(2);
    expect(targets).toContain('ExponentPushToken[111]');
    expect(targets).toContain('apns_token_222');
    expect(targets).not.toContain('fcm_token_333'); // Excluded revoked token
  });

  it('manages worker lease recovery for notification dispatches (R11)', () => {
    const now = Date.now();
    const job: NotificationOutboxRecord = {
      id: 'notif_1',
      deduplicationKey: 'GHOST_OPENED:u1:g1',
      recipientUserId: 'u1',
      eventType: 'GHOST_OPENED',
      payload: { ghostId: 'g1' },
      status: 'PENDING',
      attemptCount: 0,
    };

    expect(canClaimNotificationJob(job, now)).toBe(true);

    const claimed = claimNotificationJob(job, 'worker_A', now);
    expect(claimed.status).toBe('PROCESSING');
    expect(claimed.leaseUntilMs).toBe(now + NOTIFICATION_LEASE_DURATION_MS);

    // Lease active -> cannot claim
    expect(canClaimNotificationJob(claimed, now + 10000)).toBe(false);

    // Worker crashes. Time advances past 30s lease
    const crashedTime = now + NOTIFICATION_LEASE_DURATION_MS + 1000;
    expect(canClaimNotificationJob(claimed, crashedTime)).toBe(true);

    const recovered = claimNotificationJob(claimed, 'worker_B', crashedTime);
    expect(recovered.workerId).toBe('worker_B');
    expect(recovered.attemptCount).toBe(2);
  });
});
