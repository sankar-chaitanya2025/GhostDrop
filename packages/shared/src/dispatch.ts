import { hashPayload } from './crypto.js';

export interface UserRelationship {
  requesterId: string;
  addresseeId: string;
  relationshipStatus: 'ACCEPTED' | 'BLOCKED';
}

export interface CreateGhostParams {
  senderId: string;
  recipientId: string;
  unlockRadiusMeters: number;
  unopenedLifetimeSeconds: number;
  decayDurationSeconds: number;
  maxViews: number;
}

export const MIN_UNLOCK_RADIUS_METERS = 25;
export const MAX_UNLOCK_RADIUS_METERS = 500;
export const MIN_UNOPENED_LIFETIME_SECONDS = 3600; // 1 hour
export const MAX_UNOPENED_LIFETIME_SECONDS = 604800; // 7 days
export const ALLOWED_DECAY_DURATIONS_SECONDS = new Set([300, 600, 900, 1800]); // 5, 10, 15, 30 min

/**
 * Validates whether a sender is authorized to dispatch a Ghost to a recipient (ARCHITECTURE.md §14.1, H30).
 */
export function validateRecipientEligibility(
  senderId: string,
  recipientId: string,
  relationship: UserRelationship | null
): { allowed: boolean; errorCode?: 'FORBIDDEN_RECIPIENT' } {
  if (senderId === recipientId) {
    return { allowed: false, errorCode: 'FORBIDDEN_RECIPIENT' };
  }

  // Senders cannot dispatch without mutual accepted relationship
  if (!relationship || relationship.relationshipStatus !== 'ACCEPTED') {
    return { allowed: false, errorCode: 'FORBIDDEN_RECIPIENT' };
  }

  return { allowed: true };
}

/**
 * Validates Ghost creation constraints and parameters.
 */
export function validateCreateGhostParameters(params: CreateGhostParams): {
  valid: boolean;
  error?: string;
} {
  if (
    params.unlockRadiusMeters < MIN_UNLOCK_RADIUS_METERS ||
    params.unlockRadiusMeters > MAX_UNLOCK_RADIUS_METERS
  ) {
    return { valid: false, error: 'INVALID_UNLOCK_RADIUS' };
  }

  if (
    params.unopenedLifetimeSeconds < MIN_UNOPENED_LIFETIME_SECONDS ||
    params.unopenedLifetimeSeconds > MAX_UNOPENED_LIFETIME_SECONDS
  ) {
    return { valid: false, error: 'INVALID_UNOPENED_LIFETIME' };
  }

  if (!ALLOWED_DECAY_DURATIONS_SECONDS.has(params.decayDurationSeconds)) {
    return { valid: false, error: 'INVALID_DECAY_DURATION' };
  }

  if (params.maxViews < 1 || params.maxViews > 3) {
    return { valid: false, error: 'INVALID_MAX_VIEWS' };
  }

  return { valid: true };
}

export interface StoredIdempotencyRecord {
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  expiresAtMs: number;
}

/**
 * Evaluates request idempotency against previously stored records (ARCHITECTURE.md §8.1, C14).
 */
export function evaluateIdempotency(
  storedRecord: StoredIdempotencyRecord | null,
  currentPayload: unknown,
  nowMs: number
):
  | { action: 'PROCEED' }
  | { action: 'RETURN_CACHED'; status: number; body: unknown }
  | { action: 'REJECT_CONFLICT'; errorCode: 'IDEMPOTENCY_CONFLICT' } {
  if (!storedRecord || nowMs >= storedRecord.expiresAtMs) {
    return { action: 'PROCEED' };
  }

  const currentHash = hashPayload(currentPayload);
  if (storedRecord.requestHash === currentHash) {
    return {
      action: 'RETURN_CACHED',
      status: storedRecord.responseStatus,
      body: storedRecord.responseBody,
    };
  }

  // Same idempotency key reused with conflicting request payload
  return { action: 'REJECT_CONFLICT', errorCode: 'IDEMPOTENCY_CONFLICT' };
}
