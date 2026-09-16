import * as crypto from 'node:crypto';

export interface DeviceKeyPair {
  publicKey: string;  // Base64
  privateKey: string; // Base64
}

export interface SignedRequestPayload {
  timestamp: number;
  nonce: string;
  seqNum: number;
  payloadHash: string; // SHA-256 of JSON string
}

/**
 * Generates an Ed25519 keypair for device enrollment.
 * Uses native Node / Web Crypto Ed25519 curve.
 */
export function generateDeviceKeyPair(): DeviceKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  return {
    publicKey: publicKey.toString('base64'),
    privateKey: privateKey.toString('base64'),
  };
}

/**
 * Computes canonical canonical data string for signing:
 * Timestamp || Nonce || SeqNum || PayloadHash
 */
export function canonicalizeSigningData(data: SignedRequestPayload): Buffer {
  const canonicalString = `${data.timestamp}:${data.nonce}:${data.seqNum}:${data.payloadHash}`;
  return Buffer.from(canonicalString, 'utf8');
}

/**
 * Hashes an arbitrary payload using SHA-256
 */
export function hashPayload(payload: unknown): string {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Signs a request payload using the device private key.
 */
export function signRequestPayload(
  privateKeyBase64: string,
  data: SignedRequestPayload
): string {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyBase64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });

  const canonicalBuffer = canonicalizeSigningData(data);
  const signature = crypto.sign(null, canonicalBuffer, privateKey);
  return signature.toString('base64');
}

/**
 * Verifies an Ed25519 signature against the enrolled device public key.
 */
export function verifyRequestSignature(
  publicKeyBase64: string,
  data: SignedRequestPayload,
  signatureBase64: string
): boolean {
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });

    const canonicalBuffer = canonicalizeSigningData(data);
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');

    return crypto.verify(null, canonicalBuffer, publicKey, signatureBuffer);
  } catch {
    return false;
  }
}
