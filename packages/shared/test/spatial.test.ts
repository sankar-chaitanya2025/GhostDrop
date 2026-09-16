import { describe, it, expect } from 'vitest';
import {
  calculateDistanceMeters,
  isWithinPerimeter,
  validateTelemetryQuality,
  evaluateVelocity,
  type GeofencePoint,
} from '../src/index.js';

describe('Spatial Geofence & Velocity Engine (ARCHITECTURE.md §6.1, §6.3)', () => {
  // Test coordinates: San Francisco Dolores Park
  const ghostCoord: GeofencePoint = { latitude: 37.7597, longitude: -122.4271 };

  it('accurately calculates distance in meters', () => {
    // 0.0001 deg lat is approximately 11.1 meters
    const nearCoord: GeofencePoint = { latitude: 37.7598, longitude: -122.4271 };
    const distance = calculateDistanceMeters(ghostCoord, nearCoord);
    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(12);
  });

  it('evaluates geofence perimeter inclusiveness', () => {
    // Exact same coordinate -> 0 meters distance -> within radius
    const exact = isWithinPerimeter(ghostCoord, ghostCoord, 50);
    expect(exact.withinPerimeter).toBe(true);
    expect(exact.distanceMeters).toBe(0);

    // Far coordinate (1km away) -> outside 50m radius
    const farCoord: GeofencePoint = { latitude: 37.7749, longitude: -122.4194 };
    const far = isWithinPerimeter(ghostCoord, farCoord, 50);
    expect(far.withinPerimeter).toBe(false);
    expect(far.distanceMeters).toBeGreaterThan(500);
  });

  it('rejects degraded GPS accuracy > 35m', () => {
    const now = Date.now();
    const validQuality = validateTelemetryQuality(now, now, 10.0);
    expect(validQuality.valid).toBe(true);

    const degradedQuality = validateTelemetryQuality(now, now, 45.0);
    expect(degradedQuality.valid).toBe(false);
    expect(degradedQuality.errorCode).toBe('ACCURACY_TOO_DEGRADED');
  });

  it('rejects stale telemetry observations older than 10s', () => {
    const now = Date.now();
    // 15 seconds old
    const staleQuality = validateTelemetryQuality(now - 15000, now, 5.0);
    expect(staleQuality.valid).toBe(false);
    expect(staleQuality.errorCode).toBe('STALE_TELEMETRY');
  });

  it('permits plausible human and vehicle travel speeds (V <= 45 m/s)', () => {
    const now = Date.now();
    const previousTrack = {
      location: ghostCoord,
      recordedAtMs: now - 10000, // 10 seconds ago
    };

    // User moved 100 meters in 10 seconds = 10 m/s (36 km/h)
    const currentLoc: GeofencePoint = {
      latitude: 37.7605,
      longitude: -122.4271,
    };

    const result = evaluateVelocity(currentLoc, now, previousTrack);
    expect(result.passed).toBe(true);
    expect(result.velocityMps).toBeGreaterThan(5);
    expect(result.velocityMps).toBeLessThan(45);
    expect(result.shouldUpdateBaseline).toBe(true);
  });

  it('flags teleportation and preserves baseline without poisoning', () => {
    const now = Date.now();
    const previousTrack = {
      location: ghostCoord, // San Francisco
      recordedAtMs: now - 10000, // 10 seconds ago
    };

    // Impossible jump: San Jose (70 km away in 10 seconds)
    const spoofedLoc: GeofencePoint = {
      latitude: 37.3382,
      longitude: -121.8863,
    };

    const result = evaluateVelocity(spoofedLoc, now, previousTrack);
    expect(result.passed).toBe(false);
    expect(result.velocityMps).toBeGreaterThan(1000);
    expect(result.shouldUpdateBaseline).toBe(false); // Do NOT poison baseline
  });

  it('discards stale baselines older than 15 minutes without penalizing user', () => {
    const now = Date.now();
    const staleTrack = {
      location: ghostCoord,
      recordedAtMs: now - 20 * 60 * 1000, // 20 minutes ago
    };

    // Even if user is far away after 20 minutes, no teleportation error
    const newLoc: GeofencePoint = {
      latitude: 37.3382,
      longitude: -121.8863,
    };

    const result = evaluateVelocity(newLoc, now, staleTrack);
    expect(result.passed).toBe(true);
    expect(result.velocityMps).toBe(0);
    expect(result.shouldUpdateBaseline).toBe(true);
  });
});
