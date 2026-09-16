# T14: Client GPS Proximity & Signed Verification Loop

**What to build:** Client telemetry service (`apps/mobile/src/location.ts`) and verification loop. Coordinates challenge nonces, signs observations using the device private key, tracks sequence numbers, calls `POST /v1/location/verify`, and manages the 60s `UnlockAuthorization` countdown state (ARCHITECTURE.md §6.2, §6.3, R01, R14, R15, R16).

**Blocked by:** T08 (Short-Lived UnlockAuthorization Issuance), T13 (React Native / Expo Shell & Dark Radar Map).

**Status:** completed

## Acceptance Criteria
- [ ] Telemetry client module (`apps/mobile/src/location.ts`) constructs signed observation payloads with challenge nonces and monotonic sequence numbers.
- [ ] State controller handles the transition from `DISCOVERED_LOCKED` to `UNLOCKABLE` and starts the 60-second warning countdown.
- [ ] Handles re-locking if the user does not open within the 60s authorization window.
- [ ] Automated tests verify the client-side telemetry signing, verification parsing, and unlock countdown state transitions.
