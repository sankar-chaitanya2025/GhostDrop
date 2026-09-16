# T13: React Native / Expo Shell & Dark Radar Map

**What to build:** React Native / Expo application shell (`apps/mobile`), dark-mode vector map view model, and radar pulse proximity components. Connects client state to `GET /v1/ghost/active` to render floating beacons with live distance tickers and proximity color glows (dim fog >500m, beacon 100-500m, pulsing neon <100m) (ARCHITECTURE.md §3.1, §6.4, §13).

**Blocked by:** T07 (Active Ghost Query & Keyset Obfuscation).

**Status:** completed

## Acceptance Criteria
- [ ] Mobile app package initialized under `apps/mobile` with package dependencies (`react`, `react-native`, `expo`).
- [ ] Map radar view model (`apps/mobile/src/radar.ts`) calculates dynamic pulse frequencies and glow styles from distance bands.
- [ ] Test suite verifies radar styling and beacon mapping across all distance bands.
