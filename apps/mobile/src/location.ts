import {
  hashPayload,
  signRequestPayload,
  type SignedRequestPayload,
  type GeofencePoint,
} from '@ghostdrop/shared';

export interface ClientLocationObservation {
  ghostId: string;
  coords: GeofencePoint;
  accuracyMeters: number;
}

export interface ClientVerificationState {
  ghostId: string;
  status: 'LOCKED' | 'UNLOCKABLE' | 'EXPIRED';
  unlockAuthId: string | null;
  unlockAuthExpiresAtMs: number | null;
  exactCoords: GeofencePoint | null;
}

/**
 * Prepares and signs a location observation payload for server verification (ARCHITECTURE.md §6.2).
 */
export function prepareSignedObservationPayload(
  observation: ClientLocationObservation,
  challengeNonce: string,
  seqNum: number,
  devicePrivateKeyBase64: string,
  nowMs: number
): { payload: Record<string, unknown>; signature: string } {
  const payload = {
    ghost_id: observation.ghostId,
    challenge_nonce: challengeNonce,
    reported_latitude: observation.coords.latitude,
    reported_longitude: observation.coords.longitude,
    reported_accuracy_meters: observation.accuracyMeters,
    client_timestamp: nowMs,
    seq_num: seqNum,
  };

  const signingData: SignedRequestPayload = {
    timestamp: nowMs,
    nonce: challengeNonce,
    seqNum,
    payloadHash: hashPayload(payload),
  };

  const signature = signRequestPayload(devicePrivateKeyBase64, signingData);

  return { payload, signature };
}

/**
 * Updates client verification state based on server response (Resolves R01).
 */
export function applyVerificationSuccess(
  ghostId: string,
  unlockAuthId: string,
  exactCoords: GeofencePoint,
  expiresAtMs: number
): ClientVerificationState {
  return {
    ghostId,
    status: 'UNLOCKABLE',
    unlockAuthId,
    unlockAuthExpiresAtMs: expiresAtMs,
    exactCoords,
  };
}

/**
 * Checks remaining time on UnlockAuthorization; returns to LOCKED if expired.
 */
export function evaluateUnlockAuthorizationState(
  state: ClientVerificationState,
  nowMs: number
): ClientVerificationState {
  if (state.status === 'UNLOCKABLE' && state.unlockAuthExpiresAtMs && nowMs >= state.unlockAuthExpiresAtMs) {
    return {
      ...state,
      status: 'LOCKED', // Re-locks: must re-verify location
      unlockAuthId: null,
      unlockAuthExpiresAtMs: null,
    };
  }
  return state;
}
