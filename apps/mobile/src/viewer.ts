export interface EphemeralViewerState {
  ghostId: string;
  viewSessionId: string;
  decayExpiresAtMs: number;
  isBlurred: boolean;
  isDecayed: boolean;
  rawPayloadBuffer: Uint8Array | null;
}

/**
 * Initializes volatile viewing state with raw payload in RAM (ARCHITECTURE.md §13.1).
 */
export function initializeViewerState(
  ghostId: string,
  viewSessionId: string,
  decayExpiresAtMs: number,
  payloadBytes: Uint8Array
): EphemeralViewerState {
  return {
    ghostId,
    viewSessionId,
    decayExpiresAtMs,
    isBlurred: false,
    isDecayed: false,
    rawPayloadBuffer: payloadBytes, // Direct reference to volatile buffer
  };
}

/**
 * Calculates millisecond-precision remaining decay duration taking server clock skew into account.
 */
export function calculateRemainingDecayMs(
  decayExpiresAtMs: number,
  currentClientTimeMs: number,
  serverClockSkewMs: number = 0
): number {
  const authoritativeCurrentTime = currentClientTimeMs - serverClockSkewMs;
  return Math.max(0, decayExpiresAtMs - authoritativeCurrentTime);
}

/**
 * Handles OS backgrounding event (screen lock or app switch).
 * Blurs screen immediately to prevent OS snapshot caching.
 */
export function handleAppBackgrounded(state: EphemeralViewerState): EphemeralViewerState {
  return {
    ...state,
    isBlurred: true,
  };
}

/**
 * Handles OS app foreground resumption.
 * If decay deadline passed while backgrounded, zeroes RAM buffers immediately.
 */
export function handleAppResumed(
  state: EphemeralViewerState,
  nowMs: number,
  serverClockSkewMs: number = 0
): EphemeralViewerState {
  const remainingMs = calculateRemainingDecayMs(state.decayExpiresAtMs, nowMs, serverClockSkewMs);

  if (remainingMs <= 0) {
    return destroyViewerState(state);
  }

  return {
    ...state,
    isBlurred: false,
  };
}

/**
 * Performs memory scrubbing: overwrites byte buffers with zeros (0x00) and severs references (R11).
 */
export function destroyViewerState(state: EphemeralViewerState): EphemeralViewerState {
  if (state.rawPayloadBuffer) {
    state.rawPayloadBuffer.fill(0); // Explicit zeroing of memory
  }

  return {
    ...state,
    isBlurred: true,
    isDecayed: true,
    rawPayloadBuffer: null,
  };
}
