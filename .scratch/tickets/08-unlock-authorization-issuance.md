# T08: Short-Lived UnlockAuthorization Issuance (60s TTL)

**What to build:** `unlock_authorizations` database migration and verification issuance logic. Replaces indefinite unlock bypass with a single-use 60-second authorization token bound to `(ghost_recipient_id, user_id, device_id, session_id)`. Verifies that stale authorizations expire and that departing the geofence without redeeming reverts recipient state to `DISCOVERED_LOCKED` (ARCHITECTURE.md §3.1, §4.2, §6.2, R01, R17).

**Blocked by:** T04 (Spatial Geofence & Velocity Engine), T07 (Active Ghost Query & Keyset Obfuscation).

**Status:** completed

## Acceptance Criteria
- [ ] Supabase SQL migration creates `unlock_authorizations` table with strict TTL constraints and 0-client RLS.
- [ ] Pure authorization validator (`packages/shared/src/unlock.ts`) validates authorization issuance, 60s TTL expiration, and single-use redemption flags.
- [ ] Unit tests verify that expired authorizations cannot be redeemed and departing the geofence prevents bypass.
