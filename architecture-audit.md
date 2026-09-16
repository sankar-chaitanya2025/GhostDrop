# Ghost Drop 2.0 — Architecture Audit

## Purpose

This document is the mandatory defect register for the previous Ghost Drop 2.0 architecture.

The previous architecture was reviewed for production robustness and received a robustness assessment of approximately 62/100.

This document records the defects that must be addressed in the next architecture revision.

This is not optional feedback.
Every item marked CRITICAL or HIGH is a mandatory redesign requirement.

The next architecture must explicitly trace every CRITICAL and HIGH item to a concrete fix.

---

# CRITICAL DEFECTS

## C01 — Physical Presence Claim Is Overstated

The previous design describes server-side GPS/geofence verification as establishing that the recipient is physically present at the unlock location.

GPS telemetry cannot prove physical presence.

The revised design must explicitly define location as untrusted telemetry that provides evidence of reported device position, not cryptographic proof of human physical presence.

The product language must be changed accordingly.

Residual spoofing risk must be documented.

---

## C02 — Client-Controlled `is_mock` Is Not a Security Boundary

The previous design relies on a client-provided mock-location flag.

A malicious client can falsify this value.

The revised architecture must treat all client-side mock-location indicators as untrusted signals.

They may contribute to risk scoring or rejection heuristics but must never constitute the sole security decision.

---

## C03 — Velocity Detection Can Be Poisoned

The previous design stores a generic `User.last_known_location` and uses it as a velocity baseline.

This allows stale, cross-device, or attacker-controlled state to influence velocity checks.

The revised design must introduce appropriate Device and Session identity.

Velocity calculations must be bound to a specific device/session where appropriate.

The architecture must define:

- sequence numbers
- monotonic client event ordering
- server receipt time
- freshness windows
- baseline validity
- stale-baseline behavior
- cross-device behavior
- impossible-travel handling
- rate limits

---

## C04 — Client Device Timestamp Is Insufficiently Defined

The previous API accepts device timestamps without a sufficiently strong freshness and replay contract.

The revised architecture must explicitly define:

- server timestamp
- client timestamp
- acceptable clock skew
- freshness window
- monotonic sequence requirement
- replay handling
- stale-event handling
- out-of-order handling

Server time must remain authoritative.

---

## C05 — Request Signing / Temporary Nonce Model Is Underspecified

The previous design mentions temporary cryptographic signing but does not define:

- nonce issuance
- nonce storage
- expiry
- binding
- replay prevention
- one-time consumption
- device/session association
- failure behavior

The revised design must either fully specify this mechanism or remove it.

No cryptographic mechanism may exist only as architectural prose.

---

## C06 — Signed Media URL Is Not Actually One-Time

A 60-second signed URL is reusable during its lifetime.

It therefore does not implement true one-time media access.

The revised design must define a media-access mechanism that is:

- single-use, OR
- cryptographically bound to a specific consumption authorization, OR
- otherwise reconciled with the actual view-count/consumption model.

The architecture must explicitly address:

- replay
- parallel downloads
- token leakage
- cancellation
- retry
- concurrent requests
- partial downloads

---

## C07 — Media View Count Is Not Bound to Actual Media Access

The previous `view_count` exists at the domain level but signed media access can bypass the application-level consumption counter.

The revised design must ensure that actual authorized payload access is coupled to the server-side consumption invariant.

A user must not be able to obtain content repeatedly while the application believes it was viewed only once.

---

## C08 — Multi-Recipient Purge Logic Is Contradictory

The previous architecture contains conflicting rules:

- payload should survive until all recipients are consumed/expired
- Worker 2 deletes payload when any recipient is consumed/expired

These rules cannot both be true.

The revised architecture must define one explicit invariant.

For shared payloads:

`payload may be permanently deleted only when no authorized recipient can still validly access it`

The architecture must show the exact SQL/state transition logic implementing this invariant.

---

## C09 — PostgreSQL and Object Storage Are Not Atomic Together

The previous design relies on database transactions while also moving/deleting objects in external storage.

PostgreSQL transactions cannot atomically commit object-storage operations.

The revised architecture must use an explicit durable coordination protocol.

Acceptable designs include:

- transactional outbox
- saga
- durable cleanup jobs
- compensating actions
- reconciliation workers

The revised design must define recovery after crashes at every cross-system boundary.

---

## C10 — Purge SLA Is Not Guaranteed

Two workers running every 60 seconds do not prove deletion within 60 seconds.

There is scheduling delay plus execution plus object-storage latency.

The revised design must clearly distinguish:

- logical deletion time
- purge requested time
- object deletion completion time
- worst-case operational latency

Product language must not promise stronger deletion guarantees than the system can actually provide.

---

## C11 — Client Grace Window Contradicts Server-Authoritative Decay

The previous design says decay is server-authoritative but also says the client can pause decay for a 45-second connection grace window.

Those cannot simultaneously be true unless the server deadline itself is changed.

The revised architecture must choose one model.

Preferred model:

`decay_expires_at` is server-authoritative and immutable after creation.

Any grace period must be represented by an explicit server-authorized deadline extension, with strict rules.

A client-side pause alone must never change actual server expiration.

---

## C12 — `ghost-open` Has Race Conditions

Multiple open requests can arrive simultaneously.

The previous design does not sufficiently define locking/conditional transition behavior.

The revised design must guarantee that concurrent requests cannot:

- create multiple independent decay windows
- issue multiple consumption authorizations incorrectly
- increment view counts inconsistently
- return content after expiration
- bypass max-view limits

All state transitions must be atomic and conditional.

---

## C13 — TTL Expiration and Open Can Race

The architecture does not define what happens when:

- an open request reaches the server near TTL expiration
- a cron worker expires the ghost simultaneously
- an unlock request races with expiration

The revised design must define one deterministic rule based on server-side transactional ordering.

---

## C14 — Ghost Creation Has No Idempotency Contract

Network retries can create duplicate ghosts and duplicate notifications.

The revised design must provide idempotency for ghost creation.

The contract must specify:

- idempotency key
- key scope
- expiry
- payload equivalence
- replay response
- conflicting reuse behavior
- notification deduplication

---

## C15 — Notification Delivery Is Not Durable

Push notification sending is treated as an immediate side effect.

Failures and retries are not modeled.

The revised design must use a durable outbox or equivalent.

Notifications must support:

- retry
- deduplication
- failure handling
- dead-letter behavior
- multi-device delivery

---

## C16 — Destructive Confirmation Can Be Client-Authoritative

The previous `ghost-confirm-view-or-decay` endpoint permits the client to trigger irreversible server-side deletion.

A malicious client must never be able to cause unauthorized destructive transitions.

The revised design must make all destructive transitions server-validated and conditional.

Client events may be evidence or requests, not authority.

---

# HIGH DEFECTS

## H01 — Lifecycle Model Is Ambiguous

The glossary contains Ghost lifecycle states while the database primarily stores recipient-specific states.

The revised design must explicitly separate:

- Ghost-level lifecycle
- GhostRecipient lifecycle
- Payload lifecycle

The source of truth for each state must be defined.

---

## H02 — `REVOKED` Exists in Glossary but Not in Enum

The revised design must either:

- implement `REVOKED` fully, including all transition rules, authorization, persistence, notifications, and cleanup

or

- remove the concept everywhere.

No zombie states.

---

## H03 — Media Model Does Not Cleanly Support PHOTO + VOICE

The previous model uses one `media_storage_path` despite allowing composite payloads.

The revised architecture must model multiple media assets cleanly.

At minimum it must support:

- text
- photo
- voice
- photo + voice

Video is out of MVP and must be removed from the MVP domain model unless there is a strong architectural reason to retain a future extension placeholder.

---

## H04 — `CONSUMED` Is Overloaded

The previous model uses `CONSUMED` for multiple semantic outcomes.

The revised design must distinguish:

- viewed and naturally decayed
- view limit reached
- explicitly revoked
- unopened expiration

Only introduce separate states when they materially improve invariants or observability.

---

## H05 — State Transitions Are Not Strongly Guarded

State updates must never rely on the client holding the latest state.

The architecture must specify compare-and-set / conditional-update semantics.

Example conceptual pattern:

`UPDATE ... WHERE state = expected_state AND ...`

Then verify affected-row count before continuing.

---

## H06 — “Zero-Knowledge Payload” Is Incorrect

The server can access/decrypt content and issue it to the recipient.

Therefore the architecture must not call this zero-knowledge.

Use accurate terminology such as:

- server-authorized ephemeral payload
- access-controlled encrypted payload
- ephemeral protected media

unless genuine end-to-end encryption is introduced.

---

## H07 — Unlock Audit Records Retain Excessive Sensitive Data

The architecture records:

- exact location
- distance
- device mock state
- OS
- battery
- velocity

There is no explicit retention policy.

The revised design must specify:

- purpose
- retention duration
- minimization
- access controls
- deletion/anonymization
- whether exact location is necessary after verification

---

## H08 — `last_known_location` Has No Retention Policy

The revised design must specify:

- why it exists
- who can access it
- how fresh it must be
- how long it is stored
- when it is deleted
- whether it is device-scoped rather than account-scoped

---

## H09 — Exact Ghost Coordinates Are Exposed Too Early

The previous API exposes exact coordinates to recipients before unlock.

The revised design must explicitly decide whether this is required.

If exact coordinates are not essential, return a privacy-preserving approximation or metadata until unlock.

If they are essential to the product, document the privacy tradeoff.

---

## H10 — Signed URLs Create an Exfiltration Window

A signed URL can escape the application.

The revised design must explain:

- URL lifetime
- binding
- one-time use
- concurrency
- revocation
- whether range requests are allowed
- whether downloads can continue after logical consumption

---

## H11 — Client Cache Wiping Is Best Effort

The client cannot guarantee absolute deletion from all device storage.

The architecture must explicitly distinguish:

- application-controlled temporary files
- OS caches
- screenshots
- crash dumps
- memory
- backups
- system snapshots

Product claims must be limited accordingly.

---

## H12 — Effective Geofence Rule Is Inconsistent

The base lifecycle uses:

`distance <= radius`

while edge-case handling modifies the radius using GPS accuracy.

The revised design must define one canonical server-side geofence rule.

The exact equation must be written down and used everywhere.

---

## H13 — GPS Accuracy Is Client-Supplied

The accuracy field originates from the client and can be falsified.

The revised design must treat it as untrusted telemetry.

Do not give it cryptographic authority.

---

## H14 — “Airport Departure Context” Is Mentioned but Not Implemented

The previous architecture references contextual anti-spoof logic without defining an actual mechanism.

The revised design must either:

- implement it explicitly

or

- remove it from the architecture.

---

## H15 — No Location Freshness Policy

The system needs a precise definition of when a location observation is too old to use.

Define:

- observation freshness
- request freshness
- session freshness
- maximum accepted age

---

## H16 — No Per-Device Identity

One account can potentially use multiple devices.

The revised system needs first-class Device identity.

Define:

- device registration
- device identifier
- revocation
- multi-device behavior
- trust state

---

## H17 — No Location Verification Rate Limiting

A malicious client could generate enormous amounts of location verification traffic and audit logs.

The revised design must specify:

- per-device limits
- per-session limits
- per-user limits
- backoff behavior
- audit sampling/deduplication if necessary

---

## H18 — Single Push Token Per User Is Insufficient

Users may have multiple active devices.

The revised design must model push tokens as device-scoped records.

---

## H19 — Client Confirmation Is Too Powerful

The client can signal close/decay and trigger irreversible cleanup.

The revised system must derive destructive state from server-side truth wherever possible.

Client confirmation can accelerate cleanup only when independently validated.

---

## H20 — Viewer Lifecycle Is Undefined

The architecture does not define exactly what happens when the app is:

- backgrounded
- force-killed
- crashed
- suspended
- network-disconnected
- resumed

while content is being viewed.

---

## H21 — Crash Recovery Is Underspecified

The architecture needs a deterministic invariant for a crash between:

1. state transition
2. media authorization
3. media retrieval
4. view completion
5. purge initiation

---

## H22 — Offline/Reconnect Behavior Is Incomplete

The architecture must specify what happens when:

- user enters geofence offline
- user leaves geofence offline
- user opens while network disappears
- decay countdown continues offline
- device reconnects after expiration

Server state remains authoritative.

---

## H23 — Realtime Is Treated Too Closely to Authoritative State

Realtime events are notifications, not the source of truth.

The client must reconcile against authoritative API/database state.

---

## H24 — Push/Realtime Ordering Is Undefined

Define expected behavior when:

- push arrives before realtime
- realtime arrives before push
- both are delayed
- duplicates arrive
- neither arrives

---

## H25 — Media Upload Ownership and Validation Are Underspecified

`media_upload_id` needs explicit ownership and validation.

Define:

- uploader ownership
- staging lifecycle
- authorization
- MIME validation
- magic-byte validation
- size limits
- media count limits
- metadata validation
- malicious file handling
- abandoned upload cleanup

---

## H26 — Media Safety / Content Validation Is Missing

The revised design must define basic upload validation and resource limits.

At minimum:

- maximum byte size
- accepted formats
- MIME sniffing
- magic-byte validation
- decompression-bomb protection where relevant
- malformed media handling

Do not expand into an unnecessary moderation platform for MVP.

---

## H27 — `get_active_ghosts` Has No Pagination

The active ghost query needs a bounded result contract.

Define:

- pagination
- ordering
- page-size limits
- cursor semantics
- duplicate handling

---

## H28 — Mutating APIs Lack Full Idempotency Semantics

Every mutating endpoint must document:

- idempotency support
- retry behavior
- duplicate request behavior
- concurrency behavior
- transactional boundaries

---

## H29 — Error Contracts Are Underspecified

The revised architecture must define formal error categories/codes for important cases including:

- unauthorized
- forbidden
- invalid state
- expired
- outside geofence
- stale location
- spoof suspicion
- rate limited
- conflict
- replay
- duplicate request
- upload invalid
- payload unavailable
- server retryable failure

---

## H30 — Friend / Recipient Authorization Is Missing

The product contains a friend/user relationship story but no domain architecture.

The revised MVP must define the minimum recipient authorization model.

At minimum specify:

- who can send to whom
- blocked users
- invalid recipients
- deleted users
- recipient privacy
- authorization checks

If friend functionality is deferred, state that explicitly and remove dependent claims.

---

## H31 — Abuse / Block / Report Model Is Missing

At minimum, the architecture should define whether block/report functionality exists in MVP.

If deferred, define how unauthorized or abusive sending is constrained.

---

## H32 — Account / Device Lifecycle Is Missing

Define:

- account deletion
- session revocation
- device removal
- push token invalidation
- what happens to active Ghosts
- what happens to pending payloads
- retention implications

---

# MEDIUM / IMPORTANT DEFECTS

## M01 — Architecture Claims “100% Production Grade” Without Contracts

Do not describe the architecture as production-grade unless the actual contracts support that claim.

---

## M02 — Unlock Token and Signed URL Concepts Are Conflated

Separate:

1. authorization to unlock
2. authorization to retrieve media

Define exactly what each credential means and how they interact.

---

## M03 — Auditability vs Hard Purge Needs Explicit Policy

The system wants irreversible payload deletion while retaining some operational evidence.

Define which metadata survives and for how long.

Never imply all traces disappear unless technically true.

---

## M04 — Multiregion Cleanup Claim Is Unsupported

If multiregion/object-replication behavior is claimed, explicitly model it.

Otherwise remove the claim.

---

## M05 — Service Seams Are Too Broad

`GhostVaultStorage` currently hides too many concerns.

Define clearer boundaries between:

- authorization
- payload repository
- object storage
- purge orchestration
- media token issuance

---

## M06 — Service Boundaries Hide Important Security State

Security-relevant operations must have explicit inputs and outputs.

Avoid architecture where a single high-level method implicitly performs too many security decisions.

---

## M07 — Testing Must Be Adversarial

Add tests for:

- forged mock flag
- forged accuracy
- stale timestamps
- replayed requests
- replayed media authorization
- poisoned velocity baseline
- duplicate create
- duplicate open
- simultaneous opens
- simultaneous expiry
- storage failure
- notification failure
- offline recovery

---

## M08 — Object Deletion Must Be Tested Independently

A database row disappearing does not prove object storage deletion.

Tests must verify both logical and physical cleanup behavior.

---

## M09 — Privacy Regression Testing Is Required

The revised architecture must include automated checks for:

- unauthorized coordinate exposure
- unauthorized payload access
- leaked media tokens
- excessive audit retention
- logs containing payload data
- logs containing unnecessary precise coordinates

---

# REQUIRED ARCHITECTURAL INVARIANTS

The revised architecture must satisfy all of the following invariants.

## I01 — Server Authority

The server is authoritative for:

- state
- TTL
- decay deadlines
- authorization
- payload availability
- consumption limits

---

## I02 — Untrusted Location

Client location values, accuracy, mock flags, timestamps, and similar telemetry are untrusted inputs.

---

## I03 — Race Safety

All important state transitions are atomic and conditional.

---

## I04 — No Client-Authoritative Destruction

A client cannot independently cause irreversible deletion without server validation.

---

## I05 — Payload Lifetime

A shared payload survives as long as at least one recipient remains legitimately capable of accessing it.

---

## I06 — Durable Cross-System Cleanup

Database state and object-storage state are reconciled through explicit durable workflows.

---

## I07 — Idempotency

Retries do not create duplicate domain effects.

---

## I08 — Device Awareness

Devices and sessions are first-class security/domain entities.

---

## I09 — Media Authorization

Media access is bound to the server-side consumption model.

---

## I10 — Accurate Privacy Claims

The architecture and product copy never claim guarantees the implementation cannot provide.

---

# REQUIRED TRACEABILITY

The next architecture document must include a Decision Log mapping every C01-C16 and H01-H32 item to a specific redesign decision.

Do not mark an item resolved merely by changing terminology.

For every item, the revised architecture must contain an actual behavioral, schema, API, security, lifecycle, or testing change where appropriate.

If several defects are solved by one redesign, explicitly list all affected audit IDs.

---

# REQUIRED SECOND-PASS CONSISTENCY AUDIT

After producing the revised architecture, perform a separate internal consistency pass across:

- entities
- enums
- foreign keys
- indexes
- lifecycle states
- timers
- invariants
- APIs
- authorization
- storage
- signed credentials
- device/session model
- location model
- retries
- idempotency
- notification outbox
- purge workflow
- privacy retention
- testing

The final architecture must contain no contradictory state machines, timers, deletion rules, or security assumptions.