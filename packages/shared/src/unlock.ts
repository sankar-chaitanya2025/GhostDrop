import { UNLOCK_AUTHORIZATION_TTL_SECONDS } from './index.js';

export interface UnlockAuthorizationRecord {
  id: string;
  ghostRecipientId: string;
  userId: string;
  deviceId: string;
  sessionId: string;
  isRedeemed: boolean;
  createdAtMs: number;
  expiresAtMs: number;
}

/**
 * Creates a new 60-second UnlockAuthorization record upon successful spatial verification.
 */
export function issueUnlockAuthorization(
  ghostRecipientId: string,
  userId: string,
  deviceId: string,
  sessionId: string,
  nowMs: number
): UnlockAuthorizationRecord {
  return {
    id: `ua_${crypto.randomUUID()}`,
    ghostRecipientId,
    userId,
    deviceId,
    sessionId,
    isRedeemed: false,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + UNLOCK_AUTHORIZATION_TTL_SECONDS * 1000,
  };
}

/**
 * Validates whether an UnlockAuthorization is eligible for redemption during POST /ghost/open (R01).
 */
export function validateUnlockAuthorizationRedemption(
  auth: UnlockAuthorizationRecord | null,
  userId: string,
  deviceId: string,
  sessionId: string,
  nowMs: number
): { valid: boolean; errorCode?: 'UNLOCK_AUTH_NOT_FOUND' | 'UNLOCK_AUTH_EXPIRED' | 'SESSION_MISMATCH' } {
  if (!auth) {
    return { valid: false, errorCode: 'UNLOCK_AUTH_NOT_FOUND' };
  }

  // Session & Device binding verification
  if (auth.userId !== userId || auth.deviceId !== deviceId || auth.sessionId !== sessionId) {
    return { valid: false, errorCode: 'SESSION_MISMATCH' };
  }

  // Single-use check and strict 60s TTL check
  if (auth.isRedeemed || nowMs >= auth.expiresAtMs) {
    return { valid: false, errorCode: 'UNLOCK_AUTH_EXPIRED' };
  }

  return { valid: true };
}
