import type { GhostRecipientState, ViewSessionStatus } from './index.js';

export interface GhostRecord {
  id: string;
  expiresAtMs: number;
  decayDurationSeconds: number;
  maxViews: number;
  lifecycleState: 'ACTIVE' | 'CLOSING' | 'EXPIRED' | 'REVOKED' | 'FULLY_CONSUMED';
}

export interface GhostRecipientRecord {
  id: string;
  ghostId: string;
  recipientId: string;
  state: GhostRecipientState;
  viewCount: number;
  firstOpenedAtMs: number | null;
  decayExpiresAtMs: number | null;
}

export interface ViewSessionRecord {
  id: string;
  ghostRecipientId: string;
  userId: string;
  deviceId: string;
  sessionId: string;
  sessionStatus: ViewSessionStatus;
  createdAtMs: number;
  expiresAtMs: number;
}

/**
 * Simulates atomic Compare-And-Swap (CAS) Ghost opening with strict row locking (ARCHITECTURE.md §7.3).
 */
export function executeAtomicGhostOpen(
  ghost: GhostRecord,
  recipient: GhostRecipientRecord,
  userId: string,
  deviceId: string,
  sessionId: string,
  nowMs: number
): {
  success: boolean;
  errorCode?: 'GHOST_EXPIRED' | 'VIEW_LIMIT_EXHAUSTED' | 'INVALID_STATE';
  updatedRecipient?: GhostRecipientRecord;
  newViewSession?: ViewSessionRecord;
} {
  // Check 1: Parent Ghost expiration
  if (nowMs >= ghost.expiresAtMs || ghost.lifecycleState === 'EXPIRED' || ghost.lifecycleState === 'REVOKED') {
    return { success: false, errorCode: 'GHOST_EXPIRED' };
  }

  // Check 2: Max views limit (Resolves R03)
  if (recipient.viewCount >= ghost.maxViews) {
    return { success: false, errorCode: 'VIEW_LIMIT_EXHAUSTED' };
  }

  // Check 3: State guard (Must be UNLOCKABLE or already OPENED_DECAYING within decay deadline)
  if (recipient.state !== 'UNLOCKABLE' && recipient.state !== 'OPENED_DECAYING') {
    return { success: false, errorCode: 'INVALID_STATE' };
  }

  // If already OPENED_DECAYING, verify decay deadline has not passed
  if (recipient.state === 'OPENED_DECAYING' && recipient.decayExpiresAtMs && nowMs >= recipient.decayExpiresAtMs) {
    return { success: false, errorCode: 'GHOST_EXPIRED' };
  }

  // Calculate immutable decay deadline
  const decayExpiresAtMs = recipient.decayExpiresAtMs ?? nowMs + ghost.decayDurationSeconds * 1000;

  const updatedRecipient: GhostRecipientRecord = {
    ...recipient,
    state: 'OPENED_DECAYING',
    viewCount: recipient.viewCount + 1,
    firstOpenedAtMs: recipient.firstOpenedAtMs ?? nowMs,
    decayExpiresAtMs,
  };

  const newViewSession: ViewSessionRecord = {
    id: `vs_${crypto.randomUUID()}`,
    ghostRecipientId: recipient.id,
    userId,
    deviceId,
    sessionId,
    sessionStatus: 'ACTIVE',
    createdAtMs: nowMs,
    expiresAtMs: decayExpiresAtMs,
  };

  return {
    success: true,
    updatedRecipient,
    newViewSession,
  };
}
