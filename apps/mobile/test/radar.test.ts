import { describe, it, expect } from 'vitest';
import { buildGhostBeaconViewModel } from '../src/radar.js';

describe('Client Dark Radar Map ViewModels (ARCHITECTURE.md §3.1, §6.4, §13)', () => {
  it('renders intense neon green beacon with rapid pulse when proximity is imminent (<100m)', () => {
    const beacon = buildGhostBeaconViewModel(
      'g_1',
      'claire',
      'Under the park bridge',
      37.774,
      -122.42,
      45.0 // 45m away
    );

    expect(beacon.distanceBand).toBe('IMMINENT');
    expect(beacon.beaconStyle.color).toBe('#00FFA3');
    expect(beacon.beaconStyle.pulseFrequencyHz).toBe(2.0);
    expect(beacon.beaconStyle.statusLabel).toBe('UNLOCK PERIMETER IMMINENT');
  });

  it('renders cyan beacon with medium pulse when approaching near (100 - 500m)', () => {
    const beacon = buildGhostBeaconViewModel(
      'g_2',
      'alex',
      'Behind library',
      37.774,
      -122.42,
      250.0 // 250m away
    );

    expect(beacon.distanceBand).toBe('NEAR');
    expect(beacon.beaconStyle.color).toBe('#00E5FF');
    expect(beacon.beaconStyle.pulseFrequencyHz).toBe(1.0);
    expect(beacon.beaconStyle.statusLabel).toBe('APPROACHING GHOST');
  });

  it('renders dim fog beacon with slow pulse when far away (>500m)', () => {
    const beacon = buildGhostBeaconViewModel(
      'g_3',
      'jordan',
      'Rooftop',
      37.774,
      -122.42,
      1200.0 // 1.2km away
    );

    expect(beacon.distanceBand).toBe('FAR');
    expect(beacon.beaconStyle.color).toBe('#7B8296');
    expect(beacon.beaconStyle.pulseFrequencyHz).toBe(0.3);
    expect(beacon.beaconStyle.statusLabel).toBe('SIGNAL IN THE DISTANCE');
  });
});
