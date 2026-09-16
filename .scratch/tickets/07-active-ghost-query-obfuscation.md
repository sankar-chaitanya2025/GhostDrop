# T07: Active Ghost Query & Keyset Obfuscation

**What to build:** Active ghosts query logic with keyset cursor pagination and coordinate obfuscation prior to unlock. Implements coarse centroid grid snapping (200m resolution) and scalar distance tier classification (`FAR`, `NEAR`, `IMMINENT`) to prevent coordinate exfiltration (ARCHITECTURE.md §6.4, §8.2, H09, H27, R22).

**Blocked by:** T06 (Ghost Dispatch & Mutual-Friend Authorization).

**Status:** completed

## Acceptance Criteria
- [ ] Obfuscation module (`packages/shared/src/obfuscation.ts`) implements deterministic 200m grid cell centroid calculation.
- [ ] Categorizes distance into distance bands: `FAR` (>500m), `NEAR` (100–500m), and `IMMINENT` (<100m).
- [ ] Keyset pagination encoder/decoder handles opaque cursors based on `(created_at, ghost_id)`.
- [ ] Unit tests verify that exact coordinates are never revealed in obfuscated models and keyset pagination orders deterministically.
