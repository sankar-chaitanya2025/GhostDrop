import * as crypto from 'node:crypto';

export interface LocationChallenge {
  id: string;
  sessionId: string;
  challengeNonce: string;
  isRedeemed: boolean;
  createdAt: number; // Unix timestamp ms
  expiresAt: number; // Unix timestamp ms
}

export const CHALLENGE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Creates a cryptographically random, unguessable challenge nonce.
 */
export function generateChallengeNonce(): string {
  return `cn_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Validates whether a challenge is eligible for redemption.
 */
export function validateChallengeRedemption(
  challenge: LocationChallenge,
  currentTimestamp: number
): { valid: boolean; reason?: 'ALREADY_REDEEMED' | 'EXPIRED' } {
  if (challenge.isRedeemed) {
    return { valid: false, reason: 'ALREADY_REDEEMED' };
  }
  if (currentTimestamp >= challenge.expiresAt) {
    return { valid: false, reason: 'EXPIRED' };
  }
  return { valid: true };
}

/**
 * Validates strictly monotonic sequence number progression (Resolves R15).
 * Incoming seqNum MUST be strictly greater than lastSeqNum.
 */
export function validateMonotonicSequence(
  incomingSeqNum: number,
  lastSeqNum: number
): { valid: boolean; error?: string } {
  if (!Number.isInteger(incomingSeqNum) || incomingSeqNum <= 0) {
    return { valid: false, error: 'INVALID_SEQUENCE_FORMAT' };
  }
  if (incomingSeqNum <= lastSeqNum) {
    return {
      valid: false,
      error: `REPLAYED_SEQUENCE: incoming seq ${incomingSeqNum} <= last verified seq ${lastSeqNum}`,
    };
  }
  return { valid: true };
}
