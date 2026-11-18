# Studexa foundation pass

Verified locally on 17 November 2026. This completes a bounded foundation repair,
not the full production roadmap or every Phase 0 requirement.

## Changes

- Fixed the Windows Maven wrapper crash when the Maven cache directory has no
  symbolic-link target. Maven version is unchanged.
- Added V18 for the missing `created_at` and `updated_at` columns on focus sessions
  and boss fights. Existing rows use `completed_at` for both audit timestamps.
  Applied migrations V1–V17 are unchanged.
- Matched quiz options and room settings mappings to V12's TEXT columns. Their
  JSON-string API representation remains unchanged.
- Switched the two injected quiz-controller mappers to the Jackson version
  provided by Spring Boot 4. No compatibility bean or dependency upgrade needed.
- Corrected CI's PostgreSQL host for jobs running on the Ubuntu runner, frontend
  lockfile cache path, and shell wrapper invocation. Added backend test reports.
- Made test datasource overrides consistent between main/test resource files.
- Added EN/KM key parity, fresh-schema migration, V17 upgrade/backfill, and quiz
  JSON persistence regression coverage.
- Made OpenAPI generator installation use its lockfile through `npm ci`.

## Verification

| Check | Result |
|---|---|
| Backend `./mvnw.cmd -B verify` | PASS: 73 tests, zero failures/errors; executable JAR packaged |
| Fresh schema migrated V1–V18 | PASS, isolated schema in dedicated test DB |
| V17 schema with existing activities upgraded to V18 | PASS; data and completion timestamps preserved |
| Frontend `npm.cmd run lint` | PASS |
| Frontend `npm.cmd test` | PASS: 10 tests across 4 files, including EN/KM parity |
| Frontend `npm.cmd run build` | PASS: TypeScript, Vite and PWA generation |
| Clean dependency installation / API regeneration | Not run; existing installed dependencies used; no API contract changed |
| Hosted CI, browser E2E, accessibility, load tests | Not run in this pass |

Before these repairs, the wrapper failed before starting Maven. Once repaired,
the backend suite exposed missing activity columns, incompatible quiz JSON
mapping, and missing Jackson 2 mapper beans. After the fixes, the complete suite
passed. The existing app-start tests cover the startup failures; additional
tests exercise historical-row backfill and JSON text round-tripping.

## Running locally

From `backend`, run `./mvnw.cmd -B verify` (Windows), or `sh ./mvnw -B verify`
(Linux). The dedicated PostgreSQL test database must exist; use `.env.example`
for configuration. `TEST_DB_URL` must name a database ending in `_test`.
Migration regression tests create and remove only their uniquely named schemas.

From `frontend`, use Node 24 or Node 22.13+, then run `npm ci`, `npm run lint`,
`npm test`, and `npm run build`. Use `npm.cmd` on Windows if PowerShell blocks
`npm.ps1`.

Start the backend with `./mvnw.cmd spring-boot:run` and the frontend with
`npm.cmd run dev`. On backend startup V18 applies automatically. Manually check
login, note creation/reload, focus history, and quiz creation in both languages.
These browser checks remain outstanding.

## Risks and remaining work

- V18 performs an UPDATE and ALTER TABLE on activity tables; schedule the normal
  migration deployment window if they hold substantial data. Audit timestamps on
  old rows are inferred from completion time, not recovered creation timestamps.
- This working folder has no `.git` metadata, so no branch, commit, diff against
  main, PR, or hosted Actions run was possible.
- CI still needs API drift checking, dependency/secret scans and browser E2E.
  The migration tests cover fresh installs and V17 upgrades, not arbitrary
  historical release-tag databases.
- Planning data already calls server APIs, but account data remains in persisted
  Zustand and custom fetch wrappers. See `FRONTEND_DATA_SOURCES.md` for the next
  bounded implementation area. Idempotency, account isolation, and reward
  authority still require review before launch.
- The existing PWA build succeeds; that alone does not establish safe offline
  review synchronization or cache isolation.
- The complete P0-C open-question audit, legal/product decisions, email delivery,
  deployment accounts, production hardening and launch checks remain pending.
- Local configuration enabled verbose framework logs during tests. Production
  log redaction and configuration need the separate P0-3 security pass.

No secrets, pricing, consent policy, XP values, or production deployment settings
were introduced by this foundation pass.
