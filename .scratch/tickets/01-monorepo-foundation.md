# T01: Monorepo Foundation & Supabase Local Test Harness

**What to build:** The foundational monorepo structure (`packages/shared`, `apps/mobile`, `supabase`), root workspace configuration (`pnpm-workspace.yaml`, root `package.json`, root `tsconfig.json`), Supabase CLI project initialization, and Vitest test harness setup.

**Blocked by:** None (can start immediately).

**Status:** completed

## Acceptance Criteria
- [ ] Root `pnpm-workspace.yaml` and `package.json` created with modern TypeScript tooling.
- [ ] `packages/shared` package initialized with TypeScript build and type exports for core domain entities.
- [ ] `supabase init` executed with migrations folder and configuration established.
- [ ] Automated verification test (`packages/shared/test/domain.test.ts`) passes green via `pnpm test`.
