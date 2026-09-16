import { classifyDistanceBand, type DistanceBand } from '@ghostdrop/shared';

export interface GhostBeaconViewModel {
  ghostId: string;
  senderUsername: string;
  locationHint: string;
  obfuscatedLat: number;
  obfuscatedLng: number;
  distanceMeters: number;
  distanceBand: DistanceBand;
  beaconStyle: {
    color: string;
    glowRadius: number;
    pulseFrequencyHz: number;
    statusLabel: string;
  };
}

/**
 * Maps raw active ghost models into UI-ready dark radar beacon viewmodels.
 */
export function buildGhostBeaconViewModel(
  ghostId: string,
  senderUsername: string,
  locationHint: string,
  obfuscatedLat: number,
  obfuscatedLng: number,
  distanceMeters: number
): GhostBeaconViewModel {
  const distanceBand = classifyDistanceBand(distanceMeters);

  let beaconStyle: GhostBeaconViewModel['beaconStyle'];

  switch (distanceBand) {
    case 'IMMINENT': // < 100m
      beaconStyle = {
        color: '#00FFA3', // Intense neon spectral green
        glowRadius: 24,
        pulseFrequencyHz: 2.0, // Rapid high-stakes pulse
        statusLabel: 'UNLOCK PERIMETER IMMINENT',
      };
      break;
    case 'NEAR': // 100 - 500m
      beaconStyle = {
        color: '#00E5FF', // Bright ethereal cyan
        glowRadius: 14,
        pulseFrequencyHz: 1.0,
        statusLabel: 'APPROACHING GHOST',
      };
      break;
    case 'FAR': // > 500m
    default:
      beaconStyle = {
        color: '#7B8296', // Dim spectral fog gray
        glowRadius: 6,
        pulseFrequencyHz: 0.3, // Slow ambient pulse
        statusLabel: 'SIGNAL IN THE DISTANCE',
      };
      break;
  }

  return {
    ghostId,
    senderUsername,
    locationHint,
    obfuscatedLat,
    obfuscatedLng,
    distanceMeters: Math.round(distanceMeters),
    distanceBand,
    beaconStyle,
  };
}
