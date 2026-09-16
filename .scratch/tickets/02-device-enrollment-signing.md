# T02: Device Enrollment & Ed25519 Request Signing

**What to build:** Core identity migrations (`users`, `devices`, `sessions`), device keypair generation utility, and the Ed25519 signature verification middleware that validates `X-Signature`, timestamps, and nonces.

**Blocked by:** T01 (Monorepo Foundation & Supabase Local Test Harness).

**Status:** completed

## Acceptance Criteria
- [ ] Supabase SQL migration creates `users`, `devices`, and `sessions` tables with RLS policies from ARCHITECTURE.md §3.1 & §14.
- [ ] Device auth module (`packages/shared/src/crypto.ts`) implements Ed25519 keypair generation and request signing payload canonicalization.
- [ ] Verifier verifies authentic signatures and rejects forged or payload-tampered requests (`401 DEVICE_SIGNATURE_INVALID`).
- [ ] Automated integration tests verify key generation, signing, and verification.
