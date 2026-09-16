import { describe, it, expect } from 'vitest';
import {
  isTerminalRecipientState,
  canPurgeGhost,
  TERMINAL_RECIPIENT_STATES,
  MAX_PLAUSIBLE_VELOCITY_MPS,
  UNLOCK_AUTHORIZATION_TTL_SECONDS,
  MEDIA_CAPABILITY_TTL_SECONDS,
} from '../src/index.js';

describe('Domain Invariants & Terminal States (ARCHITECTURE.md §4.3)', () => {
  it('correctly identifies canonical terminal states', () => {
    expect(isTerminalRecipientState('VIEWED_DECAYED')).toBe(true);
    expect(isTerminalRecipientState('VIEW_LIMIT_REACHED')).toBe(true);
    expect(isTerminalRecipientState('EXPIRED_UNOPENED')).toBe(true);
    expect(isTerminalRecipientState('REVOKED')).toBe(true);

    expect(isTerminalRecipientState('PENDING_DELIVERY')).toBe(false);
    expect(isTerminalRecipientState('DISCOVERED_LOCKED')).toBe(false);
    expect(isTerminalRecipientState('UNLOCKABLE')).toBe(false);
    expect(isTerminalRecipientState('OPENED_DECAYING')).toBe(false);
  });

  it('enforces authoritative multi-recipient purge invariant', () => {
    // Both active: cannot purge
    expect(canPurgeGhost(['DISCOVERED_LOCKED', 'DISCOVERED_LOCKED'])).toBe(false);

    // One viewed/decayed, one still approaching: cannot purge
    expect(canPurgeGhost(['VIEWED_DECAYED', 'DISCOVERED_LOCKED'])).toBe(false);

    // One decaying, one expired: cannot purge
    expect(canPurgeGhost(['OPENED_DECAYING', 'EXPIRED_UNOPENED'])).toBe(false);

    // 100% terminal: purge is strictly permitted
    expect(canPurgeGhost(['VIEWED_DECAYED', 'VIEWED_DECAYED'])).toBe(true);
    expect(canPurgeGhost(['VIEWED_DECAYED', 'EXPIRED_UNOPENED'])).toBe(true);
    expect(canPurgeGhost(['REVOKED', 'REVOKED'])).toBe(true);
    expect(canPurgeGhost(['VIEW_LIMIT_REACHED'])).toBe(true);
  });

  it('declares verified constants matching architectural contracts', () => {
    expect(MAX_PLAUSIBLE_VELOCITY_MPS).toBe(45.0);
    expect(UNLOCK_AUTHORIZATION_TTL_SECONDS).toBe(60);
    expect(MEDIA_CAPABILITY_TTL_SECONDS).toBe(30);
  });
});
