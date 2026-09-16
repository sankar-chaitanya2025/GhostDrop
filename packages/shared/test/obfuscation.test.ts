import { describe, it, expect } from 'vitest';
import {
  calculateObfuscatedLocation,
  classifyDistanceBand,
  encodeKeysetCursor,
  decodeKeysetCursor,
} from '../src/index.js';

describe('Active Ghost Query & Obfuscation (ARCHITECTURE.md §6.4, §8.2, H09, H27)', () => {
  it('obfuscates exact coordinates onto a coarse ~200m grid centroid', () => {
    const exact = { latitude: 37.774929, longitude: -122.419416 };
    const obfuscated = calculateObfuscatedLocation(exact);

    // Assert coordinates are snapped to increments of 0.002
    expect(obfuscated.latitude).toBe(37.774);
    expect(obfuscated.longitude).toBe(-122.42);

    // Exact coordinate is NOT equal to obfuscated centroid
    expect(obfuscated.latitude).not.toBe(exact.latitude);
    expect(obfuscated.longitude).not.toBe(exact.longitude);
  });

  it('correctly maps distances into qualitative proximity bands', () => {
    expect(classifyDistanceBand(45)).toBe('IMMINENT'); // < 100m
    expect(classifyDistanceBand(99.9)).toBe('IMMINENT');

    expect(classifyDistanceBand(100)).toBe('NEAR'); // 100m - 500m
    expect(classifyDistanceBand(350)).toBe('NEAR');
    expect(classifyDistanceBand(500)).toBe('NEAR');

    expect(classifyDistanceBand(501)).toBe('FAR'); // > 500m
    expect(classifyDistanceBand(2500)).toBe('FAR');
  });

  it('encodes and decodes keyset pagination cursors with fidelity', () => {
    const cursorData = {
      createdAtMs: 1789601400000,
      ghostId: '3b129750-f823-4d76-90a6-c958611eb44a',
    };

    const encoded = encodeKeysetCursor(cursorData);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(10);

    const decoded = decodeKeysetCursor(encoded);
    expect(decoded).toEqual(cursorData);

    // Handles corrupt cursor string gracefully
    expect(decodeKeysetCursor('invalid_base64_json')).toBeNull();
  });
});
