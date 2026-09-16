# Ghost Drop 2.0 — Canonical Domain Glossary (`CONTEXT.md`)

**Document Version**: 2.1.0-ENTERPRISE-LOCKED  
**Status**: AUTHORITATIVE DOMAIN VOCABULARY  

This glossary establishes the canonical domain language for Ghost Drop 2.0 following an exhaustive adversarial robustness audit (R01–R25). All specifications, database schemas, edge workers, and test suites MUST adhere strictly to this terminology.

---

### 1. Actors & Security Identities

- **Sender**: An authenticated human user operating an enrolled, active `Device` who drafts, stages media for, and dispatches a `Ghost`.
- **Recipient**: An authenticated human user operating an enrolled, active `Device` who is explicitly designated by a Sender to receive a `Ghost`.
- **Device**: A first-class hardware registration entity representing a distinct physical installation (iOS/Android) with its own cryptographically distinct identity, public key, enrollment status, and hardware push notification bindings.
- **Session**: A time-bounded, device-scoped cryptographic authorization context issued to an authenticated User on a specific enrolled Device. All telemetry, challenges, and mutations are bound to an active Session.
- **Device Push Token**: A device-scoped notification endpoint handle (Expo/APNs/FCM) tied to an active Device, used exclusively for asynchronous wake-up signals.

---

### 2. Spatial & Ephemeral Message Constructs

- **Ghost**: The root container for a location-tethered drop. Owns spatial coordinates, geofence radius, unopened lifetime policy, consumption decay window, Sender identity, and recipient linkage.
- **Unlock Perimeter (Geofence)**: A spherical cap on Earth defined by the Ghost's geographic coordinates (`latitude`, `longitude`) in EPSG:4326 and an unlock radius $R$ (`unlock_radius_meters`).
- **Location Observation**: An untrusted telemetry payload submitted by a client Session containing reported coordinates, reported accuracy, hardware mock indicators, client timestamp, and a strictly monotonic sequence counter.
- **Spatial Verification**: A server-side algorithm evaluating untrusted Location Observations against the Unlock Perimeter, speed plausibility limits, freshness windows, and session identity.
- **UnlockAuthorization**: A short-lived (60-second), single-use server-side capability record issued to an active Session upon successful Spatial Verification. An `UnlockAuthorization` is atomically redeemed to initiate a viewing session. It prevents permanent bypass of physical perimeter checks.
- **GhostRecipient**: The relational state entity binding a specific Ghost to a designated Recipient. Owns recipient-specific delivery, geofence status, view counts, and consumption deadlines.
- **MediaAsset**: An individual binary file (photo, voice note) or encrypted text note associated with a Ghost, staged, validated, and managed under durable outbox workflows.

---

### 3. Consumption, Views & Authorization Tokens

- **ViewSession**: A server-tracked, bounded viewing window initiated when a Recipient redeems an `UnlockAuthorization`. A `ViewSession` remains valid until the authoritative decay deadline elapses or the user dismisses the screen.
- **MediaCapability**: A single-use, cryptographically signed, short-lived (30-second) streaming ticket derived from an active `ViewSession`, authorizing exactly one HTTP byte stream transfer.
- **Unopened Lifetime (TTL)**: The fixed global duration (default 24h) from Ghost creation after which unopened Ghosts transition to `EXPIRED`.
- **Decay Deadline (`decay_expires_at`)**: An immutable, server-authoritative timestamp established the millisecond the first `ViewSession` commits. No client-side pause or disconnection can alter this deadline.

---

### 4. Canonical State Classifications

#### A. Ghost Lifecycle States (`ghosts.lifecycle_state`)
- `ACTIVE`: The Ghost is live and awaiting recipient travel.
- `CLOSING`: At least one recipient has opened or expired, but other recipients remain eligible.
- `EXPIRED`: The global Unopened Lifetime elapsed before any recipient opened the Ghost.
- `REVOKED`: The Sender explicitly recalled the Ghost prior to any recipient opening it.
- `FULLY_CONSUMED`: 100% of designated recipients have reached terminal states and all associated payloads have been permanently purged.

#### B. GhostRecipient Lifecycle States (`ghost_recipients.state`)
- `PENDING_DELIVERY`: Recipient has not yet acknowledged or queried the Ghost.
- `DISCOVERED_LOCKED`: Ghost is visible to Recipient as an approximate spatial marker with distance; payload access is strictly forbidden.
- `UNLOCKABLE`: Server has issued an active, non-expired `UnlockAuthorization` for this recipient; client may trigger open.
- `OPENED_DECAYING`: Recipient has redeemed an `UnlockAuthorization` and is within an active decay window.
- `VIEWED_DECAYED`: The consumption decay deadline elapsed naturally; payload access is permanently severed.
- `VIEW_LIMIT_REACHED`: Maximum allowed view sessions were consumed; payload access is severed.
- `EXPIRED_UNOPENED`: Global unopened TTL expired while in `PENDING_DELIVERY` or `DISCOVERED_LOCKED`.
- `REVOKED`: Sender recalled the Ghost before the recipient opened it.

#### C. Formal Terminal State Definition
A `GhostRecipient` is in a **Terminal State** if and only if:
$$\text{State} \in \{\text{'VIEWED\_DECAYED'}, \text{'VIEW\_LIMIT\_REACHED'}, \text{'EXPIRED\_UNOPENED'}, \text{'REVOKED'}\}$$

#### D. Authoritative Multi-Recipient Purge Invariant
$$\text{AllowPurge}(\text{ghost\_id}) \iff \forall \, r \in \text{ghost\_recipients}_{\text{ghost\_id}}, \, r.\text{state} \in \text{TerminalStates}$$
No payload binary or database record may be permanently purged while at least one recipient remains non-terminal.

---

### 5. Durable Workflows & Queues

- **Storage Finalization Queue (`storage_finalization_queue`)**: A durable transactional outbox ensuring uploaded media binaries are safely moved from staging quarantine into protected vault storage with exponential backoff and lease recovery.
- **Purge Job Queue (`purge_job_queue`)**: A durable asset-centric saga queue guaranteeing that object storage deletions and database metadata purges occur reliably even across worker crashes or storage API timeouts.
- **Notification Outbox (`notification_outbox`)**: A durable outbox guaranteeing at-least-once push notification delivery with deduplication keys and worker crash recovery leases.
