# T04: Spatial Geofence & Velocity Engine

**What to build:** Spatial computation engine implementing canonical Haversine / WGS-84 ellipsoidal distance calculations, observation freshness checks, signal accuracy filtering, and velocity threshold evaluation ($V \le 45\text{ m/s}$).

**Blocked by:** T03 (Location Challenge & Monotonic Sequence Enforcement).

**Status:** completed

## Acceptance Criteria
- [ ] Pure spatial engine (`packages/shared/src/spatial.ts`) implements spherical / ellipsoidal distance calculation matching PostGIS `ST_Distance`.
- [ ] Freshness validator checks $|t_{\text{server}} - t_{\text{client}}| \le 10.0\text{s}$ and reported accuracy $\le 35.0\text{m}$.
- [ ] Velocity analysis computes $\Delta d / \Delta t$ against session baseline; rejects teleportation $> 45\text{ m/s}$ ($162\text{ km/h}$).
- [ ] Automated tests verify exact perimeter inclusion/exclusion and velocity anomaly rejection.
