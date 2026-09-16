export * from './crypto.js';
export * from './challenge.js';
export * from './spatial.js';
export * from './media.js';

export type UUID = string;

export type GhostLifecycleState =
  | 'ACTIVE'
  | 'CLOSING'
  | 'EXPIRED'
  | 'REVOKED'
  | 'FULLY_CONSUMED';

export type GhostRecipientState =
  | 'PENDING_DELIVERY'
  | 'DISCOVERED_LOCKED'
  | 'UNLOCKABLE'
  | 'OPENED_DECAYING'
  | 'VIEWED_DECAYED'
  | 'VIEW_LIMIT_REACHED'
  | 'EXPIRED_UNOPENED'
  | 'REVOKED';

export type MediaAssetType = 'TEXT_NOTE' | 'PHOTO' | 'VOICE_NOTE';

export type MediaAssetLifecycleState =
  | 'STAGED'
  | 'ASSOCIATED'
  | 'PURGE_PENDING'
  | 'PURGED';

export type PurgeKind = 'OBJECT_AND_METADATA' | 'METADATA_ONLY';

export type ViewSessionStatus = 'ACTIVE' | 'CLOSED_BY_USER' | 'EXPIRED_BY_DECAY';

export const TERMINAL_RECIPIENT_STATES: ReadonlySet<GhostRecipientState> = new Set([
  'VIEWED_DECAYED',
  'VIEW_LIMIT_REACHED',
  'EXPIRED_UNOPENED',
  'REVOKED',
]);

export function isTerminalRecipientState(state: GhostRecipientState): boolean {
  return TERMINAL_RECIPIENT_STATES.has(state);
}

export function canPurgeGhost(recipientStates: GhostRecipientState[]): boolean {
  if (recipientStates.length === 0) return false;
  return recipientStates.every(isTerminalRecipientState);
}

export interface GeofencePoint {
  latitude: number;
  longitude: number;
}

export interface LocationObservationPayload {
  ghost_id: UUID;
  challenge_nonce: string;
  reported_latitude: number;
  reported_longitude: number;
  reported_accuracy_meters: number;
  seq_num: number;
  client_timestamp: number;
}

export const MAX_PLAUSIBLE_VELOCITY_MPS = 45.0; // 162 km/h
export const MAX_RELIABLE_GPS_ACCURACY_METERS = 35.0;
export const MAX_OBSERVATION_AGE_SECONDS = 10.0;
export const UNLOCK_AUTHORIZATION_TTL_SECONDS = 60;
export const MEDIA_CAPABILITY_TTL_SECONDS = 30;
