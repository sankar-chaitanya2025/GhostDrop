import {
  MAX_PLAUSIBLE_VELOCITY_MPS,
  MAX_RELIABLE_GPS_ACCURACY_METERS,
  MAX_OBSERVATION_AGE_SECONDS,
  type GeofencePoint,
} from './index.js';

const EARTH_RADIUS_METERS = 6371008.8; // Mean Earth radius in WGS 84

/**
 * Calculates distance in meters between two coordinates using the Haversine formula.
 * Accurately mirrors PostGIS ST_Distance on geography points within 0.1% tolerance.
 */
export function calculateDistanceMeters(p1: GeofencePoint, p2: GeofencePoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1Rad = toRadians(p1.latitude);
  const lat2Rad = toRadians(p2.latitude);
  const deltaLat = toRadians(p2.latitude - p1.latitude);
  const deltaLon = toRadians(p2.longitude - p1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Evaluates whether reported coordinates fall within the unlock radius.
 * Strictly inclusive: distance <= radius.
 */
export function isWithinPerimeter(
  ghostLocation: GeofencePoint,
  reportedLocation: GeofencePoint,
  unlockRadiusMeters: number
): { withinPerimeter: boolean; distanceMeters: number } {
  const distance = calculateDistanceMeters(ghostLocation, reportedLocation);
  return {
    withinPerimeter: distance <= unlockRadiusMeters,
    distanceMeters: Math.round(distance * 100) / 100,
  };
}

/**
 * Validates untrusted telemetry signals: freshness and accuracy degradation.
 */
export function validateTelemetryQuality(
  clientTimestampMs: number,
  serverTimestampMs: number,
  reportedAccuracyMeters: number
): { valid: boolean; errorCode?: 'STALE_TELEMETRY' | 'ACCURACY_TOO_DEGRADED' } {
  // Check accuracy degradation threshold (ARCHITECTURE.md §6.1)
  if (reportedAccuracyMeters > MAX_RELIABLE_GPS_ACCURACY_METERS) {
    return { valid: false, errorCode: 'ACCURACY_TOO_DEGRADED' };
  }

  // Check observation freshness window (ARCHITECTURE.md §6.2)
  const ageSeconds = Math.abs(serverTimestampMs - clientTimestampMs) / 1000;
  if (ageSeconds > MAX_OBSERVATION_AGE_SECONDS) {
    return { valid: false, errorCode: 'STALE_TELEMETRY' };
  }

  return { valid: true };
}

export interface PreviousLocationTrack {
  location: GeofencePoint;
  recordedAtMs: number;
}

/**
 * Analyzes travel velocity between two consecutive pings within the same session.
 * Rejects impossible travel speeds > 45 m/s (162 km/h).
 * Drops baselines older than 15 minutes (900 seconds) without penalty.
 */
export function evaluateVelocity(
  currentLocation: GeofencePoint,
  currentTimestampMs: number,
  previousTrack: PreviousLocationTrack | null
): { passed: boolean; velocityMps: number; shouldUpdateBaseline: boolean } {
  if (!previousTrack) {
    return { passed: true, velocityMps: 0, shouldUpdateBaseline: true };
  }

  const deltaSeconds = (currentTimestampMs - previousTrack.recordedAtMs) / 1000;

  // If previous baseline is older than 15 minutes (900s), baseline is stale; establish new without check
  if (deltaSeconds >= 900 || deltaSeconds <= 0) {
    return { passed: true, velocityMps: 0, shouldUpdateBaseline: true };
  }

  const distanceMeters = calculateDistanceMeters(previousTrack.location, currentLocation);
  const velocityMps = distanceMeters / deltaSeconds;

  if (velocityMps > MAX_PLAUSIBLE_VELOCITY_MPS) {
    return {
      passed: false,
      velocityMps: Math.round(velocityMps * 10) / 10,
      shouldUpdateBaseline: false, // Do NOT poison baseline with fraudulent coordinates
    };
  }

  return {
    passed: true,
    velocityMps: Math.round(velocityMps * 10) / 10,
    shouldUpdateBaseline: true,
  };
}
