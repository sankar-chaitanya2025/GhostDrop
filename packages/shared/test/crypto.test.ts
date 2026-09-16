import { describe, it, expect } from 'vitest';
import {
  generateDeviceKeyPair,
  hashPayload,
  signRequestPayload,
  verifyRequestSignature,
  type SignedRequestPayload,
} from '../src/index.js';

describe('Device Enrollment & Ed25519 Request Signing (ARCHITECTURE.md §6.3, R14)', () => {
  it('generates valid Ed25519 keypairs', () => {
    const keyPair = generateDeviceKeyPair();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey.length).toBeGreaterThan(32);
  });

  it('verifies authentic signed telemetry payloads', () => {
    const { publicKey, privateKey } = generateDeviceKeyPair();

    const payload = {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 5.0,
    };

    const signingData: SignedRequestPayload = {
      timestamp: 1789601400,
      nonce: 'nonce_challenge_882194',
      seqNum: 42,
      payloadHash: hashPayload(payload),
    };

    const signature = signRequestPayload(privateKey, signingData);
    expect(signature).toBeDefined();

    const isValid = verifyRequestSignature(publicKey, signingData, signature);
    expect(isValid).toBe(true);
  });

  it('rejects tampered telemetry payloads', () => {
    const { publicKey, privateKey } = generateDeviceKeyPair();

    const originalPayload = { latitude: 37.7749, longitude: -122.4194 };
    const tamperedPayload = { latitude: 37.7750, longitude: -122.4194 }; // Tampered by adversary

    const signingData: SignedRequestPayload = {
      timestamp: 1789601400,
      nonce: 'nonce_challenge_882194',
      seqNum: 42,
      payloadHash: hashPayload(originalPayload),
    };

    const signature = signRequestPayload(privateKey, signingData);

    // Verifier checks tampered payload hash
    const verificationData: SignedRequestPayload = {
      ...signingData,
      payloadHash: hashPayload(tamperedPayload),
    };

    const isValid = verifyRequestSignature(publicKey, verificationData, signature);
    expect(isValid).toBe(false);
  });

  it('rejects replayed signatures against mismatched nonces or sequence numbers', () => {
    const { publicKey, privateKey } = generateDeviceKeyPair();

    const signingData: SignedRequestPayload = {
      timestamp: 1789601400,
      nonce: 'nonce_first',
      seqNum: 1,
      payloadHash: hashPayload({ action: 'verify' }),
    };

    const signature = signRequestPayload(privateKey, signingData);

    // Replay attack with different nonce
    const replayedData: SignedRequestPayload = {
      ...signingData,
      nonce: 'nonce_second',
    };

    expect(verifyRequestSignature(publicKey, replayedData, signature)).toBe(false);
  });
});
