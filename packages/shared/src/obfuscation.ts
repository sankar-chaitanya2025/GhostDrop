import type { GeofencePoint } from './index.js';

export type DistanceBand = 'FAR' | 'NEAR' | 'IMMINENT';

// 0.002 degrees latitude is approximately 222 meters
const OBFUSCATION_GRID_STEP = 0.002;

/**
 * Snaps exact latitude/longitude to a coarse 200m grid cell centroid (ARCHITECTURE.md §6.4).
 * Prevents unauthorized physical reconnaissance before verification.
 */
export function calculateObfuscatedLocation(exactCoord: GeofencePoint): GeofencePoint {
  const obfuscatedLat = Math.round(exactCoord.latitude / OBFUSCATION_GRID_STEP) * OBFUSCATION_GRID_STEP;
  const obfuscatedLng = Math.round(exactCoord.longitude / OBFUSCATION_GRID_STEP) * OBFUSCATION_GRID_STEP;

  return {
    latitude: Math.round(obfuscatedLat * 10000) / 10000,
    longitude: Math.round(obfuscatedLng * 10000) / 10000,
  };
}

/**
 * Classifies continuous distance in meters into coarse qualitative proximity tiers.
 */
export function classifyDistanceBand(distanceMeters: number): DistanceBand {
  if (distanceMeters < 100) {
    return 'IMMINENT';
  }
  if (distanceMeters <= 500) {
    return 'NEAR';
  }
  return 'FAR';
}

export interface KeysetCursorData {
  createdAtMs: number;
  ghostId: string;
}

/**
 * Encodes keyset pagination parameters into an opaque URL-safe base64 cursor.
 */
export function encodeKeysetCursor(data: KeysetCursorData): string {
  const jsonStr = JSON.stringify(data);
  return Buffer.from(jsonStr, 'utf8').toString('base64url');
}

/**
 * Decodes an opaque base64 cursor into deterministic keyset sorting parameters.
 */
export function decodeKeysetCursor(cursor: string): KeysetCursorData | null {
  try {
    const jsonStr = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr) as KeysetCursorData;
    if (typeof parsed.createdAtMs === 'number' && typeof parsed.ghostId === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
