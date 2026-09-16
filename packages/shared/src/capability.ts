import * as crypto from 'node:crypto';
import { MEDIA_CAPABILITY_TTL_SECONDS } from './index.js';

export interface MediaCapabilityRecord {
  id: string;
  viewSessionId: string;
  mediaAssetId: string;
  capabilityToken: string;
  isRedeemed: boolean;
  createdAtMs: number;
  expiresAtMs: number;
}

/**
 * Generates a short-lived, single-use MediaCapability token (ARCHITECTURE.md §5.3, R02).
 */
export function issueMediaCapability(
  viewSessionId: string,
  mediaAssetId: string,
  nowMs: number
): MediaCapabilityRecord {
  return {
    id: `mc_${crypto.randomUUID()}`,
    viewSessionId,
    mediaAssetId,
    capabilityToken: `cap_${crypto.randomBytes(24).toString('hex')}`,
    isRedeemed: false,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + MEDIA_CAPABILITY_TTL_SECONDS * 1000,
  };
}

/**
 * Validates capability token redemption during initial streaming handshake.
 * Burns token atomically (isRedeemed = true).
 */
export function validateAndBurnMediaCapability(
  capability: MediaCapabilityRecord | null,
  nowMs: number
): { valid: boolean; errorCode?: 'FORBIDDEN_CAPABILITY' | 'CAPABILITY_EXPIRED' } {
  if (!capability) {
    return { valid: false, errorCode: 'FORBIDDEN_CAPABILITY' };
  }

  // Check if token was already burned (Resolves C06, R02)
  if (capability.isRedeemed) {
    return { valid: false, errorCode: 'FORBIDDEN_CAPABILITY' };
  }

  // Check if 30s capability TTL expired
  if (nowMs >= capability.expiresAtMs) {
    return { valid: false, errorCode: 'CAPABILITY_EXPIRED' };
  }

  return { valid: true };
}

/**
 * Refreshes media capability for an active ViewSession after network disconnect (Resolves R12).
 * Verifies that the ViewSession and decay window remain active.
 */
export function refreshMediaCapability(
  viewSessionStatus: 'ACTIVE' | 'CLOSED_BY_USER' | 'EXPIRED_BY_DECAY',
  decayExpiresAtMs: number,
  viewSessionId: string,
  mediaAssetId: string,
  nowMs: number
): { success: boolean; errorCode?: 'VIEW_SESSION_CLOSED' | 'DECAY_EXPIRED'; newCapability?: MediaCapabilityRecord } {
  if (viewSessionStatus !== 'ACTIVE') {
    return { success: false, errorCode: 'VIEW_SESSION_CLOSED' };
  }

  if (nowMs >= decayExpiresAtMs) {
    return { success: false, errorCode: 'DECAY_EXPIRED' };
  }

  const newCapability = issueMediaCapability(viewSessionId, mediaAssetId, nowMs);
  return { success: true, newCapability };
}
