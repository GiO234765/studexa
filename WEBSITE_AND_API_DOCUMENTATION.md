# Studexa: Codex Build Guide

**Purpose:** Step-by-step instructions for an AI coding agent (Codex) to take Studexa from a working prototype to a production-ready, worldwide study app.
**Based on:** `WEBSITE_AND_API_DOCUMENTATION.md` v2.0 (review date 17 Nov 2026).
**How to use:** Put this file in the repo root. Give Codex **one task at a time** (Section 12 has the prompt templates). Never ask for "everything at once".

**Implementation baseline (17 Nov 2026):** See `docs/BASELINE.md`,
`docs/VERSIONS.md`, and `docs/FRONTEND_DATA_SOURCES.md` for findings from running
the actual checkout. Migrations already included V16 and V17; the foundation
repair adds V18. Planning/activity data already reaches server APIs through
Zustand actions, so P0-1 is a state-management and reliability migration rather
than a first server integration. The roadmap below remains planned work unless
explicitly marked verified in the baseline report.

> **Honest note on "no mistakes":** no process guarantees zero mistakes. What this guide does is reduce them: small tasks, verify-before-change, tests for every change, explicit acceptance criteria, and a review checklist you run after each task. Following the order and the rules below is the best protection.

---

## 0. Rules for Codex (read before every task)

Paste or reference this section in `AGENTS.md` at the repo root so Codex reads it every time.

### 0.1 Ground rules

1. **Read before writing.** Before changing anything, read the relevant existing code, the migration list, and the section of `WEBSITE_AND_API_DOCUMENTATION.md` that applies. The documentation was written by review, not by running the code, and contains items tagged `[VERIFY]`. **The code is the source of truth. If the doc and the code disagree, trust the code and report the difference.**
2. **Do not upgrade dependencies** (Spring Boot 4.1.x, React 19.x, Vite 8.x, Tailwind 4.x, etc.) unless a task says so. Check `pom.xml` and `package.json` for the real versions. Your training data may describe older major versions (for example Spring Boot 3, Spring Security 6, Jackson 2). APIs and package names can differ; compile early and often, and read the library's own docs or source in the dependency jar rather than guessing.
3. **Never edit an already-applied Flyway migration.** Always add a new one. The latest known is `V18`. Check the folder first; use the next free number. Migration numbers in later task examples are illustrative, not reservations.
4. **One task = one branch = one pull request.** Branch name: `feat/<task-id>-<slug>`. Small, reviewable commits.
5. **Every change ships with tests.** No task is done without tests that fail before the change and pass after.
6. **Do not invent endpoints, fields, env vars or tables** that the task does not specify. If something is missing, stop and ask, or write the assumption in the PR description.
7. **Never log secrets, tokens, passwords or reset/verification links** outside local dev, and never commit `.env` or keys.
8. **Keep the server authoritative** for XP, coins, streaks, purchases, quiz scoring and AI quotas. The client is never trusted.
9. **Every user-visible string goes through i18n** with both `en` and `km` keys added in the same change. No hard-coded text.
10. **Cross-user access returns 404**, not 403, for every new endpoint (consistent with the existing design).
11. **Errors use RFC 7807 `ProblemDetail`** with a stable `code` and, for validation, a `fields` map.
12. **Do not refactor unrelated code.** If you see a problem outside the task, list it in the PR under "Found but not changed".

### 0.2 Definition of done (every task)

- [ ] Code compiles; `./mvnw test` and `npm run lint`, `npm test`, `npm run build` all pass.
- [ ] New/changed behavior covered by tests (unit + integration for backend; Vitest and, for user flows, Playwright).
- [ ] If the API changed: OpenAPI is updated and `npm run api:generate` was run and `schema.d.ts` committed.
- [ ] If the DB changed: new migration added; tested on a **fresh** database **and** on a database upgraded from the previous version.
- [ ] `en` and `km` i18n keys are identical (the parity test passes).
- [ ] Loading, empty, error and offline states exist for any new screen.
- [ ] No new accessibility violations (axe check on the new/changed pages).
- [ ] Docs updated (`WEBSITE_AND_API_DOCUMENTATION.md` sections touched, `.env.example` if env vars were added).
- [ ] PR description lists: what changed, how to test manually, risks, and anything "Found but not changed".

### 0.3 Stop-and-ask triggers

Codex must **stop and ask the human** instead of guessing when:
- A task needs a secret, API key, domain, or paid account.
- A migration would drop or rename existing columns/tables.
- The existing code contradicts the task's instructions.
- A legal decision is required (age limits, consent wording, data retention periods).
- A change would alter XP/coin economy numbers beyond what the task states.

---

## 1. Project Ground Truth

### 1.1 What exists today

| Area | Facts |
|---|---|
| Backend | Java 21, Spring Boot 4.1.x, PostgreSQL 16+, Flyway, Spring Security (OAuth2 Resource Server + optional Google client), springdoc (dev only) |
| Frontend | React 19, Vite 8, Tailwind 4, React Router 7, Zustand 5 (local/guest store `studexa_v1`), TanStack Query 5, i18next (en + km), openapi-fetch typed client, Tiptap, Recharts, Framer Motion, KaTeX, qrcode.react, @stomp/stompjs |
| Tests | JUnit (SRS engine: 28 tests), Vitest, Playwright, oxlint |
| Auth | Access JWT (HS256, 15 min, in memory) + opaque refresh token (SHA-256 hashed, HttpOnly cookie scoped to `/api/v1/auth`, 30 days, rotates, family revocation on reuse) |
| Game | XP (level formula `100 + (L-1)*50`, daily cap 600), coins, streaks (timezone-aware), 16 badges, daily/weekly quests, shop, pet |
| Real-time | STOMP over WebSocket; topic `/topic/room/{roomCode}`; 6-char codes from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` |
| AI | Anthropic API from the backend only; 10 calls/day/user |

### 1.2 Invariants that must never break

These are working, security-relevant behaviors. Every task must preserve them, and regression tests must exist for each.

1. Access token is never written to `localStorage`/`sessionStorage`.
2. Refresh rotation + family revocation on reuse.
3. Forgot-password always returns `202` regardless of whether the email exists.
4. Foreign resources return `404`.
5. `POST /review/answer` is idempotent through `clientReviewId`.
6. SRS engine package `com.studexa.srs` has **no** Spring/JPA/web imports.
7. Daily XP cap (600) applies to **all** XP sources.
8. Production startup fails fast on weak `JWT_SECRET`, insecure cookie, or non-HTTPS `FRONTEND_URL`.
9. Streak day boundary uses the profile timezone; AI daily limit uses UTC day (see task P1-5 about aligning or documenting this).

### 1.3 Known documentation defects (fix as you go)

The audit found these inside the documentation file. Correct them when touching those sections:

- Section numbering has **two** `7.3` headings (Tasks under Authentication, then Subjects). Renumber.
- The Tasks endpoints are listed under the Authentication section but belong with the V15 planning endpoints (§7.9).
- The Flyway heading says `V1–V13` but the table lists V14 and V15. Retitle to `V1–V15`.
- The "Indexes to confirm" bullet appears twice in §8.3.
- §7.9 has two stray table rows (`Explore`, `Boss`) after a paragraph, breaking the table.
- Several rows are still `[VERIFY]` (see Phase 0).

---

## 2. Roadmap Overview

Work in this order. Do not start a phase until the previous phase's exit criteria pass.

| Phase | Name | Goal | Exit criteria |
|---|---|---|---|
| **0** | Audit & baseline | Know the real state; green CI | All checks green; verify-list answered; CI runs backend integration tests |
| **1** | Launch blockers (P0) | Safe to let real users in | Tasks P0-1 … P0-6 done |
| **2** | Core quality (P1) | Reliable, fair, accessible, usable | Tasks P1-1 … P1-9 done |
| **3** | Retention & offline (P2a) | Daily habit, works on weak networks | Tasks P2-1 … P2-3 done |
| **4** | Scale & operations (P2b) | Safe to grow worldwide | Tasks P2-4 … P2-8 done |
| **5** | Global & growth (P2c/P3) | More languages, content, money | Tasks P2-9 … P3-x as chosen |
| **6** | Closed beta → public launch | Real students validate it | Launch checklist (Section 13) all checked |

---

## 3. Phase 0: Audit & Baseline

**Goal:** Replace every `[VERIFY]` assumption with a verified fact and make CI trustworthy.

### P0-A. Repository health

1. Run and record results of: `./mvnw test`, `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npm run api:generate`.
2. Fix **only** what blocks these from passing (do not refactor). List anything else found.
3. Confirm actual versions from `pom.xml`/`package.json`; write a `docs/VERSIONS.md` with the real numbers.
4. Pin all `—` entries in the stack table (flyway, springdoc, stomp, qrcode.react, oxlint, dexie, vite-plugin-pwa) to exact versions.

### P0-B. CI pipeline (GitHub Actions or equivalent)

Create `.github/workflows/ci.yml` with jobs:

1. **backend**: JDK 21, `postgres:16` service container, run `./mvnw verify`. Create both `studexa` and `studexa_test` databases (or point tests at one and document it). This replaces the blocked local integration tests.
2. **frontend**: Node 24 or Node 22.13+, `npm ci`, `npm run lint`, `npm test`, `npm run build` (Vitest 5 does not support Node 20).
3. **api-drift**: start backend, run `npm run api:generate`, fail if `git diff --exit-code frontend/src/lib/api/schema.d.ts` is non-empty.
4. **migrations**: run Flyway on (a) an empty DB and (b) a DB migrated at the previous release tag, then run the app's smoke test. This would have caught the V10/V11 "fix" migrations earlier.
5. **security-scan**: `gitleaks` (secrets), `npm audit --omit=dev` (fail on high/critical), OWASP dependency-check or Dependabot alerts.
6. **i18n-parity**: a test that loads `en` and `km` JSON and fails if any key exists in one but not the other.
7. **e2e** (nightly or on main): Playwright against the built app + backend.

**Acceptance:** a PR that breaks any of the above turns CI red; a clean PR is green.

### P0-C. Answer the open questions from the doc (Section 16.3)

Codex must **read the code** and write answers into `docs/OPEN_QUESTIONS_RESOLVED.md`:

| # | Question | Where to look |
|---|---|---|
| 5 | Is the 5-second undo window enforced server-side? | `ReviewService.undo`, `review_logs` timestamps |
| 6 | What happens to decks when a subject is deleted? | `SubjectService.delete`, FK `ON DELETE` rules in V3/V4 |
| 7 | Are `mediaUrl`, `starred`, `suspended` writable on create/bulk? | Card DTOs and mappers |
| 8 | Target age range / consent | Human decision (stop and ask) |
| extra | Does `REVERSED` create two review items or one card with two directions? | Card/queue code |
| extra | What is the timezone-change behavior for streaks? | `GameService`/streak code |
| extra | What exactly does `/cards/{id}/review` (legacy) do; is it still used by the frontend? | Grep frontend |

For each: state the finding, cite the file/line, and say whether a fix is needed. Do **not** change behavior in this task.

### P0-D. Frontend data-source inventory

Produce `docs/FRONTEND_DATA_SOURCES.md`: a table of every feature (decks, cards, review, notes, exams, tasks, focus sessions, boss fights, stats, quests, shop, pet, profile, settings) with its **current** source: `server (TanStack Query)`, `local (Zustand)`, or `mixed`. Find these by reading `frontend/src/lib/store.ts` and the API feature modules. This table drives task P0-1.

---

## 4. Phase 1: Launch Blockers (P0)

### P0-1. Wire Notes, Exams, Tasks, Focus Sessions, Boss Fights to the server

**Why:** The UI reads/writes persisted Zustand state, whose actions already call the V15 backend for signed-in users. Move account domain state into TanStack Query and verify cross-device persistence, error handling, and account isolation; do not assume these entities are local-only. See `docs/FRONTEND_DATA_SOURCES.md`.

**Design:**
- Introduce a **repository layer** in the frontend: one interface per entity (`NotesRepo`, `ExamsRepo`, `TasksRepo`, `FocusRepo`, `BossRepo`), with two implementations:
  - `serverRepo` (uses the typed API client + TanStack Query)
  - `guestRepo` (uses the existing local store, for `studexa_guest_mode === 'true'` only)
- A single hook per entity (`useNotes`, `useTasks`, …) picks the implementation from the auth mode. Pages call hooks only, never the store or the API directly.
- Zustand stays for **UI state and guest data only**. Registered users must never read domain data from Zustand.

**Steps:**
1. Read the five V15 controllers/DTOs and `schema.d.ts`; write a table of request/response shapes. Confirm that endpoints match §7.9 of the doc, and run `npm run api:generate` to make sure types are current.
2. Build the repositories and hooks with TanStack Query: query keys by entity and filter; optimistic updates for toggles (tasks) and note autosave; rollback on error.
3. **Notes autosave:** debounce 800 ms; show "Saving… / Saved HH:mm / Couldn't save: retry". Send `PUT /notes/{id}` only when content changed. Handle `409` (stale) by showing a "This note changed on another device" dialog with "Keep mine / Use theirs / Copy mine" (if the backend has no version column, add one in a **new migration** and a `version` field with optimistic locking).
4. **Focus session completion:** the client sends one `POST /focus-sessions` on completion; the server must award XP once (check for idempotency; if there's no `clientSessionId`, add one in a migration and enforce a unique constraint per user). Enforce the 8-sessions/day and ≥25-minute rules on the server, not only in the UI.
5. **Boss fights:** record the result on the server; XP (+100) is awarded by the server, subject to the daily cap.
6. **Existing local data migration:** on first login after this release, if the user has local notes/tasks/exams (not guest), show a one-time dialog "Upload your local data to your account?" and import via the server APIs (idempotent, with a client-side `importedAt` flag so it never runs twice). Do not auto-delete the local copy until the upload fully succeeds.
7. Remove direct use of the store for these entities in non-guest mode. Search the codebase for every import of the store accessors for these entities.

**API contract rules:**
- All list endpoints must support pagination (see P1-4) before the frontend depends on large lists; until then, cap result sizes in the server and document it.
- Foreign IDs → `404`.

**Acceptance criteria:**
- Create a note on device A (browser 1), see it on device B (browser 2) after refresh.
- Clearing site data does not lose notes for a signed-in user.
- Guest mode still works fully offline with the local repo and makes **zero** network calls for these entities.
- Awarding XP for a focus session is idempotent: replaying the same request twice yields one XP event.
- Playwright: register → create note → reload → note persists; second context sees it.

**Tests:** repo unit tests with a mocked API client; hook tests for optimistic update/rollback; backend integration tests for ownership (A cannot see B's notes → 404), XP idempotency, daily limit.

---

### P0-2. Email delivery, password reset UI, and email verification

**Why:** Users who forget a password are locked out; the reset link is only logged.

**Backend steps:**
1. Add a `MailService` interface with `send(to, templateId, locale, variables)`. Implementations: `SmtpMailService` (Spring Mail; configured by `MAIL_*`), and `LoggingMailService` active **only** under the `dev`/`test` profile. In production the logging implementation must not be loadable (use `@Profile`).
2. Provide EN and KM email templates (subject + HTML + plain text) for: password reset, email verification, "password changed" notice, "account deleted" confirmation. Templates must be localized based on `profile.language`.
3. **Forgot password:** keep the always-`202` behavior. Do the email send asynchronously (`@Async` or a queue) so response time doesn't reveal whether the account exists. Add per-email and per-IP throttling (see P0-3).
4. **Reset tokens:** single use, 30-minute expiry, stored hashed; after success, revoke **all** refresh token families for that user and send a "password changed" email.
5. **Email verification:** new migration `V16__email_verification.sql`: `users.email_verified_at TIMESTAMPTZ NULL` and `email_verification_tokens(id, user_id, token_hash, expires_at, used_at, created_at)`. Endpoints: `POST /auth/verify-email {token}`, `POST /auth/resend-verification` (rate-limited, always 202). Policy: unverified users may use the app but see a banner; **AI, quiz hosting, and Explore publishing require a verified email.**
6. Google sign-in users are verified automatically if Google reports `email_verified=true`.
7. Add `.env.example` entries: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `MAIL_FROM_NAME`, `APP_BASE_URL`.
8. Recommend a transactional provider (Amazon SES, Postmark, Resend, or Brevo) over a raw SMTP server, with SPF, DKIM and DMARC DNS set up (document these as manual steps for the human).

**Frontend steps:**
1. Add routes `/forgot-password`, `/reset-password?token=…`, `/verify-email?token=…` (public). Add them to the public route list and the route guard.
2. Forgot page: email field → always show the same success message ("If that email exists, we sent a link").
3. Reset page: new password + confirm, strength meter, show `INVALID_TOKEN` as "This link expired. Request a new one" with a button.
4. Link "Forgot password?" from the login page.
5. Unverified banner with "Resend email" (with cooldown timer).
6. All strings in EN and KM.

**Acceptance criteria:**
- Full flow tested end to end against a local mail catcher (MailHog/Mailpit) in Playwright.
- Reset token cannot be reused; expired token fails with `INVALID_TOKEN`.
- After reset, old refresh tokens no longer work.
- No reset/verification link appears in logs when the `prod` profile is active (write a test that boots the prod profile and asserts the logging mail service bean does not exist).

---

### P0-3. Production hardening & abuse protection

**Steps:**
1. **Startup guards (extend existing):** also fail fast in prod if `springdoc` is enabled, if `ANTHROPIC_API_KEY` is blank while `AI_ENABLED=true`, if `MAIL_HOST` is blank, if CORS origin is `*` or non-HTTPS, if the DB password equals the documented default.
2. **Swagger regression test:** an integration test with the prod profile asserting `/swagger-ui.html` and `/v3/api-docs` return `404`.
3. **Actuator:** expose only `health` (and `info` if wanted) publicly; everything else requires an admin role or is bound to a private management port.
4. **Security headers:** verify CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and add `Permissions-Policy` (camera only for the QR-scan page origin, microphone/geolocation denied). Ensure CSP allows required font hosts/Workbox only; no `unsafe-inline` for scripts.
5. **Origin check:** for cookie-based endpoints (`/auth/refresh`, `/auth/logout`), reject requests whose `Origin`/`Referer` is not `FRONTEND_URL`.
6. **Rate limits (see P2-4 for Redis):** per IP **and** per account for login (e.g., 5 failures / 15 min / account with backoff), register, forgot-password, resend-verification, quiz join (per IP), AI endpoints. Return `429` with a `Retry-After` header and a ProblemDetail `code: RATE_LIMITED`. The frontend shows the wait time.
7. **Password policy:** min 10 characters; reject top common passwords; optional k-anonymity breached-password check (HaveIBeenPwned range API, fail-open if unreachable). Do not enforce arbitrary composition rules.
8. **Sanitize rich text:** server-side sanitize note HTML on save (jsoup `Safelist`, allowing only Tiptap's output tags and attributes); client-side sanitize (DOMPurify) when rendering anything that is HTML (notes, card content if HTML is allowed, quiz nicknames escaped everywhere).
9. **Log hygiene:** structured JSON logs with request id; a log filter that masks `Authorization`, `Cookie`, `password`, `token` fields. Add a test that logs a login request and asserts the secret never appears.
10. **Data retention jobs:** scheduled cleanup of expired/revoked refresh tokens and used/expired reset/verification tokens (daily). In multi-instance mode use ShedLock so only one instance runs each job.
11. **Quiz-room security rules** from §9.3 of the doc: enforce server-side host-only controls, server-owned timer, correct answers only in `REVEAL`, server-issued player IDs, nickname validation (1–20 chars, no control characters) and output escaping. Add tests for each rule (see P1-1).

**Acceptance:** each item above has an automated test or a documented manual check; the prod profile boot test passes.

---

### P0-4. Account management endpoints & UI

**Backend (new migration if needed):**

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/me/change-password` | Requires current password; revokes all other refresh families; sends notice email |
| `DELETE` | `/me` | Requires password (or a fresh Google re-auth) and a typed confirmation string; deletes **all** personal data in one transaction; revokes tokens; sends confirmation email |
| `GET` | `/me/export` | Returns a downloadable `.zip` (or streamed JSON) with profile, subjects, decks, cards, card progress, review logs, notes, exams, tasks, focus sessions, boss fights, game state, XP events, badges, pet, quests |
| `GET` | `/me/sessions` | Lists active refresh token families: device label (parsed user agent), approximate location (country only, optional), `createdAt`, `lastUsedAt`, `current` flag |
| `DELETE` | `/me/sessions/{familyId}` | Revokes a device |
| `POST` | `/me/sessions/revoke-others` | "Log out everywhere else" |

**Implementation notes:**
- Add `user_agent`, `ip_hash` (hash, never raw IP), `last_used_at` to `refresh_tokens` (or a `sessions` table keyed by `family_id`) in a new migration.
- **Account deletion cascade:** write an explicit deletion service that lists every table with a `user_id` (use the ER list in doc §8.2) and a **test that fails if a new table with `user_id` exists that the deletion service doesn't handle** (query `information_schema` for columns named `user_id` and compare to the handled list). Quiz rooms hosted by the user: delete or anonymize per decision (stop and ask; default: delete their rooms and anonymize results others still see).
- Export must stream (don't build the entire file in memory) and be rate-limited (e.g., 1 per hour).
- Quiz participants who are not registered have only nickname data; define the retention (default: purge sessions older than 30 days).

**Frontend (Settings → Account):** change password form, "Active devices" list with revoke buttons, "Download my data" button (with progress), "Delete account" (typed confirmation; explains what is deleted; 7-day grace period is optional, see below).

**Optional:** a 7-day soft-delete grace period (`deleted_at`) with a "Cancel deletion" email link; a daily job hard-deletes after expiry. Ask the human which they prefer (stop-and-ask).

**Acceptance:** deletion leaves zero rows referencing the user ID in any table (test enumerates tables); export contains every category; revoked device's refresh fails.

---

### P0-5. Legal pages, consent, and age handling

> This is engineering guidance, not legal advice. Have a qualified person review the final text for the countries you target.

**Steps:**
1. Static public routes: `/privacy`, `/terms`, `/cookies` (if any non-essential cookies/analytics are used), `/contact`. Content in EN and KM (human-reviewed). Footer links on the login/register pages and in Settings → About.
2. Registration: required checkbox "I agree to the Terms and Privacy Policy" (links open in a new tab). Store `terms_accepted_at` and `terms_version` (new migration). When the terms version changes, ask the user to re-accept on next login.
3. **Age:** add a date of birth or an "I am at least N years old" step. Make the minimum age a config value (`MIN_AGE`, default 13) and a second threshold for parental consent (`PARENTAL_CONSENT_AGE`, default 16 for EU users). **Stop and ask the human** which age policy applies before implementing blocking behavior. For under-threshold users: block registration, or collect a parent email and require consent, depending on the decision.
4. For minors: public profiles are off by default; Explore publishing disabled; quiz nicknames are free-form but moderated (see P2-7); no analytics beyond essential counts.
5. **AI disclosure:** a first-use dialog on AI features explaining text is sent to a third-party provider, with "Don't ask again" and a link to the privacy policy. Allow users to disable AI entirely in Settings.
6. **Cookie/analytics consent:** if analytics beyond strictly necessary are added, show a consent banner (EN/KM) with accept/reject equally prominent; store the choice; load analytics only after consent. The refresh cookie is strictly necessary.
7. **Data processing record:** `docs/PRIVACY_DATA_MAP.md` listing each data category, purpose, retention, and processor (hosting, email provider, Anthropic, analytics).

**Acceptance:** cannot register without accepting terms; version bump re-prompts; consent preference is respected (test that analytics script isn't loaded before consent).

---

### P0-6. Release safety net

1. **Feature flags** (simple config table or env-driven): `AI_ENABLED`, `QUIZ_ROOMS_ENABLED`, `EXPLORE_ENABLED`, `GOOGLE_LOGIN_ENABLED`, `REGISTRATION_ENABLED`. Exposed to the frontend through `GET /config` (public, cacheable) so UI hides disabled features cleanly.
2. **Maintenance mode:** a flag that makes the API return `503` with ProblemDetail `code: MAINTENANCE` and the frontend show a friendly page.
3. **Version endpoint:** `GET /version` → `{ "version", "commit", "builtAt" }`. Show in Settings → About; useful for support.
4. **Error boundary** on every route in the frontend with a "Something went wrong" page and "Reload" button; ensure errors are reported to the error tracker (P2-6).
5. A real **404 page** for authenticated users (replace the blanket `/*` → `/login` for them).

**Acceptance:** each flag, when off, hides the entry points in the UI and returns a clear `403`/`404`-style ProblemDetail (`code: FEATURE_DISABLED`) from the API.

---

## 5. Phase 2: Core Quality (P1)

### P1-1. Quiz rooms: contract, tests, reconnect, host controls

**Why:** this is the headline multiplayer feature, and its contract is only partly documented.

**Steps:**
1. **Document the real contract**: read `QuizController`, `SessionController`, `AnswerController`, `QuizStompController` and write `docs/QUIZ_ROOMS_API.md`: every endpoint (method, path, auth, request, response, errors), every STOMP destination (send and subscribe), every event payload, the state machine, and timing rules. Keep the doc consistent with the code (generate payload examples from DTOs).
2. **State machine** (enforce on the server): `LOBBY → IN_QUESTION → REVEAL → (next question) → FINISHED`, plus `CANCELLED`/`EXPIRED`. Illegal transitions return a ProblemDetail and do nothing.
3. **Rules to enforce (with tests):**
   - Only the host can start/next/end (checked server-side).
   - The server owns the clock: `endsAt` is computed server-side; answers after `endsAt` (plus a small grace, e.g. 300 ms) are rejected.
   - Each player may answer each question **once**; duplicates are ignored idempotently.
   - `QUESTION` events never contain the correct answer; `REVEAL` does.
   - Scores are computed on the server (points = base + speed bonus, defined in one constant class).
   - Player IDs are server-issued; nicknames are validated (1–20 chars, trimmed, no control chars, profanity filter hook) and always escaped on display.
   - Max players per room (default 100, configurable), max questions (default 50), room expires after 4 hours of inactivity.
   - Join rate limit per IP; room code lookup constant-time-ish and not enumerable (look-alike-free alphabet already exists).
4. **WebSocket auth:** authenticate the STOMP `CONNECT` using the JWT (header `Authorization: Bearer …` in the STOMP connect headers, validated in a `ChannelInterceptor`). Guests-without-account players (if allowed) get a short-lived **player token** issued by the join endpoint. Subscriptions to `/topic/room/{code}` are allowed only for members of that room (interceptor check on `SUBSCRIBE`).
5. **Reconnect:** when a socket drops, the client reconnects with exponential backoff (1s → 10s cap) and re-subscribes; on reconnect it calls a `GET /sessions/{id}/state` snapshot (add if missing) returning current question index, remaining time, player's score, and answered flag. The UI shows "Reconnecting…" and never double-submits answers.
6. **Host controls:** kick player, skip question, extend time (+10 s, accessibility), end room early, lock room (no new joins).
7. **Heartbeats:** STOMP heartbeat 10s/10s; the server removes players who are disconnected beyond a grace period (60 s) from "active" but keeps their score.
8. **Frontend UX:** big room code + QR in the lobby, player count, "Waiting for host…", clear connection status, answer buttons with letter and shape (not color alone), "Locked in", leaderboard animation respecting reduced motion, host "Save questions as deck" at the end.
9. **Rename routes** `/quiz/*` → `/live/*` (keep redirects from old paths for a release) to avoid the collision with `/study/quiz`.

**Acceptance:** Playwright test with **three browser contexts** (host + 2 players): create, join (by code), start, answer, reveal, finish, see the leaderboard; plus tests for late answer rejection, duplicate answer, non-host start attempt (rejected), reconnect mid-question, and a load test (k6/Gatling or a Java STOMP client) with 100 players answering within a second window with no lost answers.

---

### P1-2. Game economy: anti-abuse and consistency

**Steps (server-side only; do not change the numbers beyond these):**
1. **Minimum time:** ignore XP (but still schedule the card) when `msTaken < 700` for review answers. Make the value `game.review.min-ms-for-xp` in config.
2. **Repeat damping:** the +3 XP for a given `cardId` is awarded at most **once per local day** (cards repeated through "Again" in the same session don't pay again).
3. **Session bonus:** the +20 session-complete bonus requires ≥ 5 **distinct** cards and is capped to once per N minutes (default 10).
4. **Quest progress:** rate-limit `/quests/progress` per `source` and per user; progress is accepted only from server-derived events where possible (e.g., review completed server-side triggers the quest progress internally rather than the client calling it).
5. **Server-derived pet stage and mood:** remove any client authority; compute from level and streak on the server in `GET /pet`.
6. **Coins and cap clarity:** document and test whether level-up coins and badge coins bypass the 600 XP cap. Rule: coins are not XP; they bypass the cap; XP is capped.
7. **Idempotency tests:** replay the same `clientReviewId` 5 times → exactly one XP event.
8. **Undo and XP:** `POST /review/undo` marks the matching XP event `reversed` (column from V14) and reverses coins if issued; add tests, including when the undo happens after a level-up (decide and document: level never decreases mid-day; XP and coins are adjusted but the level stays).
9. **Undo window:** enforce **server-side** the same 5-second window the UI shows (+ small grace, 2 s). Return a ProblemDetail `UNDO_EXPIRED`.
10. **Streak edge cases to automate:** 23:59 vs 00:01 local, travel across timezones, DST transitions, timezone change mid-streak (decision: streak day is computed from the timezone at the time of the activity; document it), freeze consumption at day rollover, max 2 freezes held.
11. **Level curve beyond 20:** propose a flattening option but **do not change it** without human approval (stop-and-ask).

**Acceptance:** all tests above pass; a script that taps "Again" 200 times within 20 seconds yields near-zero XP.

---

### P1-3. Guest-to-account migration

**Backend:** `POST /import/guest` (authenticated; one-time per user; idempotent by an `importId`):
- Body: subjects, decks, cards (with scheduling state), notes, tasks, exams, game summary (XP/level/streak as **advisory only**).
- Server **recomputes** anything that affects rewards. Rule: import decks, cards, notes, tasks, exams, but grant a **capped** XP/coin bonus (e.g., at most 200 XP) so guest data can't be used to forge progress.
- Validate sizes (max cards 5,000, notes 500, payload ≤ 5 MB), validate every field, sanitize rich text.
- Transactional: all or nothing; return a summary `{ imported: {decks, cards, notes, …}, skipped: [...] }`.

**Frontend:**
- On register (from guest mode), offer "Keep my progress?" with a summary count. If accepted, call the import, then clear guest data only after success.
- Guest mode: hide or disable server-only features (AI, live quiz hosting, Explore publishing, export) with a friendly "Create an account to use this" prompt.

**Acceptance:** guest creates 3 decks/50 cards/2 notes → registers → sees them on a second device; duplicate import is rejected idempotently.

---

### P1-4. API conventions: pagination, search, rate-limit responses

1. **Pagination** for list endpoints (`decks`, `cards in a deck`, `notes`, `tasks`, `exams`, `focus-sessions`, `boss-fights`, `xp events`, `quizzes`): `?page=0&size=20` (max 100), response `{ items, page, size, total, hasNext }`. Prefer **keyset pagination** (`?after=<cursor>`) for append-heavy lists (review logs, XP events).
2. **Search:** `GET /cards/search?q=&deckId=` and `GET /notes?q=&subjectId=` using the existing trigram indexes (V6). Escape LIKE wildcards. Add the missing GIN index for notes (new migration). Minimum query length 2; results limited; debounce on the client (300 ms).
3. **Indexes to verify** (create in a new migration if missing): `card_progress(user_id, due_at)`, `review_logs(user_id, reviewed_at)`, `xp_events(user_id, created_at)`, `refresh_tokens(token_hash)` unique, `refresh_tokens(family_id)`, `quiz_rooms(code)` unique, `notes(user_id, updated_at)`, `tasks(user_id, task_date)`. Use `EXPLAIN ANALYZE` on the review queue query with 50,000 cards to confirm index usage; record in the PR.
4. **Rate-limit headers:** `429` responses include `Retry-After`; optionally `X-RateLimit-Remaining`.
5. **Conflict handling:** `409` + `code: STALE_VERSION` for optimistic-lock failures on `card_progress`, `game_state`, notes; the client retries once after refetch.
6. Add every error code that was marked inferred (`card limits`, `quiz limits`, `daily XP cap`, `AI limit`, `stale version`, `UNDO_EXPIRED`, `RATE_LIMITED`, `FEATURE_DISABLED`, `MAINTENANCE`) to the table in doc §7.11 with verified status codes.

**Acceptance:** list endpoints return paginated shapes; the OpenAPI spec is updated; the frontend uses infinite scroll or "Load more" for long lists.

---

### P1-5. AI features: quotas, safety, cost control

**Implemented increment (17 Nov 2026):** Note-to-tutor attachment, localized study
prompts, explicit send disclosure, retry/offline/guest handling, exact citations,
bounded output, deterministic quota dates and the Gemini enable switch are covered
in `docs/AI_STUDY_IMPROVEMENTS.md`. This does not mark the whole P1-5 task complete;
usage reporting, cost ceilings and broader hardening below remain planned.

1. **Model configuration:** read the model name from `ANTHROPIC_MODEL` (env), never hard-code it; set a sensible default and look up the current model names in Anthropic's official documentation when configuring (do not guess model IDs).
2. **Quota endpoint:** `GET /ai/usage` → `{ used, limit, resetsAt }`. The UI shows "7 of 10 AI helpers left today. Back at HH:mm" in the user's local time. **Align the reset with the user's timezone** (preferred) or clearly document the UTC reset; the doc currently notes a UTC-vs-local mismatch.
3. **Plans:** make the limit per plan (`FREE`, `PRO`) via configuration so P2-9 (payments) can raise it.
4. **Prompt injection hardening:** treat all user-provided source text as untrusted: wrap it in clearly delimited sections, cap its size (e.g., 8,000 characters), give the model no tools, require JSON-schema output, validate the output strictly (types, lengths, count caps, `choices` count for MCQ, no HTML), and keep the existing exact-substring reference check. Strip control characters. On validation failure, retry once, then return `AI_BAD_OUTPUT`.
5. **Review-before-adding screen:** AI-generated cards are shown as a draft list with checkboxes and inline editing; nothing is saved until the user confirms. Label them "AI-generated: please check".
6. **Cost controls:** log tokens in/out per call to `ai_usage` (add columns in a migration), a daily global spend ceiling (`AI_DAILY_BUDGET_USD`) that switches AI off gracefully with a clear message, per-IP limit for new accounts (e.g., 3/day for accounts < 24h old), and a cost alert hook.
7. **Timeouts and retries:** connect/read timeouts (e.g., 30 s), a single retry on 5xx/timeouts with jitter, circuit breaker (Resilience4j) so an Anthropic outage doesn't exhaust threads.
8. **Privacy:** don't send emails, names or IDs to the AI; send only the text the user chose. No logging of prompts/responses in production (log sizes and token counts only).
9. **Language:** instruct the model to answer in the language of the source text (Khmer or English or other) and to keep Khmer script and punctuation intact; add Khmer test fixtures.

**Acceptance:** tests with a mocked Anthropic client for success, malformed JSON, oversized input, injection strings ("ignore previous instructions…") not changing the output schema, quota exhaustion, timeout, budget exceeded.

---

### P1-6. Accessibility & Khmer typography pass

**Targets:** WCAG 2.2 AA in EN and KM.

1. Add `@axe-core/playwright` checks for: login, register, onboarding, home, review, deck editor, notes, plan, stats, profile, shop, settings, live quiz screens. Fail CI on `serious`/`critical` violations.
2. **Keyboard:** all flows operable by keyboard; visible focus ring; skip-to-content link; review ratings on keys `1–4` (document in a help dialog; avoid conflicts with typing fields); spacebar flips the card.
3. **Screen readers:** landmarks; `aria-live="polite"` for XP/toast/timer-end announcements; flashcard flip announces "Answer revealed"; icon-only buttons have labels; charts have a table alternative or text summary; quiz answer buttons use letters + shapes, not only color.
4. **Reduced motion:** honor `prefers-reduced-motion` (no confetti or flips; use fades); a "Calm mode" setting that hides confetti, leaderboards and streak counters.
5. **Touch targets** ≥ 44×44 px; text scaling to 200% without clipping; the Settings font-size option scales flashcard text most.
6. **Khmer typography QA:**
   - Self-host a Khmer font (e.g., **Noto Sans Khmer**) subsetted, `font-display: swap`, with a fallback stack (`"Noto Sans Khmer", "Khmer OS", system-ui, sans-serif`); preload only the weight used above the fold.
   - `lang="km"` on Khmer content (set on `<html>` when the UI language is Khmer, and on mixed-language spans such as card text).
   - `line-height` ≥ 1.6 for Khmer body text (stacked subscripts/vowels get clipped otherwise); avoid `letter-spacing` and avoid fixed heights on text containers; use `min-height`.
   - Khmer has no spaces between words: rely on the browser's dictionary line-breaking (`word-break: normal`, `overflow-wrap: anywhere` as a safety net for long strings); don't truncate with fixed character counts, use CSS `line-clamp`. Never insert hyphenation.
   - Number formats: support Khmer numerals as an optional display setting through `Intl.NumberFormat('km-KH-u-nu-khmr')`, but store and compute with standard numbers.
   - Visual regression screenshots (Playwright) of key pages in KM with long strings.
7. **Color contrast:** audit both themes (light/dark); define design tokens (CSS variables) for text/background/border pairs with documented contrast ratios.

**Acceptance:** CI axe checks green on all listed pages in both languages; manual screen reader pass (NVDA or VoiceOver) on onboarding and review is documented in `docs/A11Y_REPORT.md`.

---

### P1-7. Stats endpoints

Replace client-derived stats with server aggregates (also required for multi-device correctness):

| Path | Returns |
|---|---|
| `GET /stats/summary?range=7d\|30d\|90d` | cards reviewed, accuracy (Good+Easy / total), minutes studied, active days, current/best streak, retention rate (cards answered correctly after being ≥ 7 days old) |
| `GET /stats/heatmap?from=&to=` | per local day: `{ date, cards, minutes }` (days computed in the user's timezone) |
| `GET /stats/subjects?range=` | per subject: cards reviewed, minutes |
| `GET /stats/forecast?days=14` | number of cards due per upcoming day |

Implement with SQL aggregates (not loading rows into memory), index-backed, and cache for 60 seconds per user. Frontend charts consume these; every chart has a data-table alternative.

**Acceptance:** results match hand-computed fixtures across timezones and DST; a 100k-row `review_logs` table responds under 200 ms locally.

---

### P1-8. Frontend performance for low-end phones

Targets (from §6.10 of the doc): initial JS ≤ ~200 KB gzipped for login/home; LCP < 2.5 s on a mid-range Android on Fast 3G emulation.

1. Route-level `React.lazy` + `Suspense` for Notes (Tiptap, KaTeX), Stats (Recharts), Minigames, Live quiz, Explore. Lazy-load `canvas-confetti` and KaTeX CSS only when needed.
2. Analyze the bundle (`rollup-plugin-visualizer`); remove or replace heavy dependencies where practical; ensure tree-shaking for icon libraries and Framer Motion (use `LazyMotion`/`m` components).
3. Images: WebP/AVIF with width/height attributes; mascot as SVG or optimized sprite; prefer CSS animations for the always-visible pet.
4. Add Lighthouse CI with budgets; fail the build on regression.
5. Memoize heavy lists (virtualize decks/cards lists > 200 items with `@tanstack/react-virtual`).
6. TanStack Query: sensible `staleTime`, `gcTime`, background refetch on focus off for expensive queries; prefetch the review queue on the Home page.
7. Compression: enable Brotli at the CDN; hashed asset names with long cache; `index.html` no-cache.

**Acceptance:** Lighthouse CI report attached to the PR; budgets enforced.

---

### P1-9. Product analytics (privacy-friendly) and funnel events

1. Pick a privacy-friendly tool (self-hosted PostHog, Plausible, Umami) or a first-party `POST /events` endpoint writing to an `events` table. **No study content, no emails, no free text.**
2. Events: `signup_completed`, `onboarding_step_completed {step}`, `first_deck_created`, `first_review_completed`, `review_session_completed {cards}`, `daily_goal_met`, `streak_broken`, `quiz_room_created`, `quiz_room_completed {players}`, `ai_used {type}`, `offline_session_synced`, `shop_purchase {itemId}`, `account_deleted`.
3. Respect consent (P0-5) and Do-Not-Track; allow opt-out in Settings.
4. Build `GET /admin/metrics` (admin role only) or a SQL view for: D1/D7/D30 retention, daily active users, time-to-first-review, daily-goal completion, AI usage vs limit.
5. Add an `ADMIN` role check (the `role` field exists on the user; ensure `USER` and `ADMIN` are enforced by method security on admin endpoints and tested).

---

## 6. Phase 3: Retention & Offline (P2a)

### P2-1. True offline mode (PWA + Dexie + sync)

**Design principles:** offline-first for **studying**; online-only for account and social features. The server remains authoritative; offline answers are replayed with their original timestamps and idempotency keys.

1. **PWA shell** with `vite-plugin-pwa` (Workbox `generateSW` or `injectManifest`): precache the app shell and built assets; manifest with name, icons (192, 512, maskable), `display: standalone`, `start_url: /`, theme colors; an install prompt UX (custom, dismissible, shown after the first completed review).
2. **Runtime caching rules:**
   - `GET /api/v1/review/queue`, `/decks`, `/cards/due`: `NetworkFirst` with a short network timeout (3 s) and cache fallback.
   - **Never** cache `/auth/*`, `/me/export`, or any non-GET. Never cache responses containing tokens.
   - Static fonts/images: `CacheFirst` with expiry.
3. **Dexie database** (`studexa-offline`): tables `queueCards` (the cached review queue per deck), `pendingAnswers` (outbox), `meta` (last sync, userId). **Namespace by user ID and clear on logout** so one user's data never leaks to the next login on a shared device.
4. **Outbox pattern:** each rating is written to `pendingAnswers` with `{ clientReviewId (UUID v4), cardId, rating, msTaken, answeredAt, baseVersion }` **before** the network call. Network success removes it; failure keeps it. The UI treats it as answered immediately (optimistic).
5. **Local scheduling while offline:** the server computes the next interval (SM-2 in Java). To avoid porting the algorithm and diverging, offline mode shows a **conservative local preview** only for the session (e.g., hide the card for this session after answering) and the server's result arrives at sync. If you port SM-2 to TypeScript, add **shared test vectors** (the same JSON fixtures run in both JUnit and Vitest) to guarantee identical output.
6. **Sync:** triggered on `online` events, app foreground (`visibilitychange`), app start, and every 60 s while online and non-empty. Send answers **in chronological order, one at a time or in a batch endpoint** (`POST /review/answers/batch`, max 100, processing each with idempotency and returning per-item results). Handle outcomes per item: `OK`, `DUPLICATE` (treat as OK), `STALE_VERSION` (refetch the card state, re-apply if the answer is still sensible), `CARD_DELETED` (drop), `INVALID` (drop and log).
7. **Daily XP cap and streak while offline:** the server decides at sync time; the UI shows "XP will be added when you're back online". Streak day attribution uses the answer's `answeredAt` converted in the profile timezone (decision: accept answers up to 48 hours old; older ones are applied to the schedule but give no XP/streak).
8. **iOS caveat:** Background Sync API isn't available on iOS Safari, so rely on foreground triggers.
9. **UX:** the offline banner changes to "Offline: your reviews are saved and will sync" with a pending count; server-only actions are disabled with an explanation; a "Prepare for offline" button downloads the next N due cards of chosen decks (default 100).
10. **Storage hygiene:** request persistent storage (`navigator.storage.persist()`), handle quota errors gracefully, and cap offline cache size.

**Acceptance:** Playwright with `context.setOffline(true)`: load the app, review 10 cards offline, go online, verify all 10 synced exactly once (including a forced duplicate send); logout clears the Dexie DB; a second user logging in on the same browser sees none of the first user's cached data.

---

### P2-2. Reminders and notifications (opt-in, kind)

1. **Preferences:** new migration `notification_preferences(user_id, email_daily_reminder, email_weekly_summary, push_enabled, reminder_time_local, quiet_hours_start, quiet_hours_end, updated_at)` and `push_subscriptions(id, user_id, endpoint, p256dh, auth, user_agent, created_at)`. Defaults: **all off** until the user opts in.
2. **Web Push:** VAPID keys in env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); service worker `push` + `notificationclick` handlers; permission is requested only after a user action (e.g., a toggle in Settings or a post-session prompt), never on first load. Remove subscriptions that return 404/410.
3. **Scheduler:** every 5 minutes, find users whose local reminder time falls in the window, who have due cards or an at-risk streak, who haven't studied today, and who are outside quiet hours; enqueue notifications. Use ShedLock/DB locks to avoid duplicates across instances. Max **1 notification per day** per user.
4. **Copy** (EN/KM, warm, never guilt-tripping): "12 cards are ready. A quick 5 minutes keeps your streak going." If the streak is at risk and the user holds a freeze: "Your streak freeze will protect you tonight."
5. **Email** reminders include a one-click unsubscribe link (signed token) and the List-Unsubscribe header.
6. **Weekly summary email:** cards reviewed, best day, streak; plain and short.

**Acceptance:** tests with a controllable clock for timezones/DST/quiet hours; no notification sent to users who opted out; unsubscribe link works without login.

---

### P2-3. Onboarding & activation polish

Goal: first rated card in under two minutes.

1. After onboarding, land on a **"Start here"** card: Create a deck, or Import (CSV/Anki), or Generate with AI (if verified), or Try a starter deck (a curated sample deck in EN/KM, e.g., "Basic Khmer–English words", "Study skills").
2. Pre-seed a **starter deck** option that adds a deck with ~15 cards in one tap (content shipped as static JSON, reviewed for quality).
3. Guided first review: a 3-step coach-mark overlay explaining ratings and the interval preview (skippable, shown once, accessible).
4. Track time-to-first-review (P1-9) and keep the median under 120 s.
5. Streak/goals: default daily goal of 10 cards; suggest a goal based on level of study.

---

## 7. Phase 4: Scale & Operations (P2b)

### P2-4. Redis & horizontal scaling

1. Add Redis (managed). Config via `REDIS_URL`. Make it **optional in dev** (fall back to in-memory when unset) but **required in prod** (startup guard).
2. **Rate limiting:** move to Bucket4j with the Redis backend (or Spring's `RedisRateLimiter`); keep the same keys/limits; keep the `Retry-After` behavior.
3. **Quiz rooms:** persist room state (current question, `endsAt`, players, scores) in Redis (or the DB) instead of memory so any instance can serve any request. For fan-out across instances, use a **STOMP broker relay** to a STOMP-capable broker (e.g., RabbitMQ with the STOMP plugin) or a Redis pub/sub bridge; **do not use sticky sessions as the long-term solution**. Document the chosen approach in `docs/SCALING.md`.
4. **Scheduled jobs:** ShedLock (JDBC or Redis) for every `@Scheduled` task.
5. **Stateless check:** run two backend instances locally behind a reverse proxy; run the Playwright quiz test through it; both must work.
6. **DB:** HikariCP pool sizing documented (`maximumPoolSize` based on instance count and DB `max_connections`); read replicas not needed yet; add slow-query logging (> 200 ms).

### P2-5. Containerization & deployment

1. `backend/Dockerfile` (multi-stage, JRE 21 slim, non-root user, `HEALTHCHECK`), `frontend` built into static assets (served by CDN or Nginx container), `docker-compose.yml` for **local full-stack** (Postgres, Redis, Mailpit, backend, frontend) as an *option*, since dev currently works without Docker.
2. Environments: `staging` and `production` with separate databases, secrets, Google OAuth redirect URIs (one per environment), domains and CORS origins.
3. Infrastructure as code (Terraform, Pulumi, or the provider's config file) for: app service, managed Postgres with daily backups + point-in-time recovery, Redis, CDN, DNS, TLS, secrets manager.
4. **Region choice:** put compute and DB in one region close to the main user base (for Cambodia, Singapore is a common choice), and serve the frontend through a CDN with global edge presence. Record the decision and measured latency from target countries.
5. CD: on merge to `main` deploy to staging → run Playwright smoke tests → manual approval → deploy to production (blue/green or rolling). Rolling deploys require **backward-compatible migrations** (expand → migrate → contract; never drop a column in the same release that stops using it).
6. Rollback runbook: `docs/RUNBOOK.md` with how to roll back the app and what to do when a migration fails.

### P2-6. Observability

1. **Logs:** JSON, with `requestId`, `userId` (UUID only), route, status, duration; ship to a log service.
2. **Metrics** (Micrometer → Prometheus/Grafana or a hosted provider): request rate/latency/error rate by route, DB pool usage, JVM, active WebSocket sessions, rooms active, AI calls/latency/tokens/cost, emails sent/failed, job durations.
3. **Tracing:** OpenTelemetry for the backend (optional).
4. **Alerts:** error-rate spike, p95 latency, `/health` failing, DB connections near max, disk space, AI budget at 80%/100%, email failure rate, certificate expiry.
5. **Frontend error tracking:** Sentry (or equivalent) with release version, UI language, route; scrub PII; sample performance traces at a low rate. Respect consent.
6. **Uptime monitor** on `/api/v1/health` and the landing page from multiple regions.
7. **Dashboards:** one for product (P1-9 metrics) and one for health.

### P2-7. Moderation & content safety (needed before public sharing)

1. **Reports:** `reports(id, reporter_id, target_type, target_id, reason, details, status, created_at)`; endpoints `POST /reports`; admin list/resolve.
2. **Public decks** must pass: verified email, a minimum account age (e.g., 24 h), title/description checks, a profanity/abuse filter (EN and KM wordlists plus a pluggable provider), and an admin "takedown" action that hides the deck and notifies the author.
3. **Quiz nicknames:** server-side filter; host can kick; repeat offenders can be blocked from joining by session fingerprint (careful with privacy; hash only).
4. **User blocking/hiding** of authors in Explore.
5. **Admin tooling:** a minimal admin UI or CLI to view reports, take down content, suspend accounts (soft ban flag checked in the auth filter).
6. **Legal:** a DMCA/copyright complaint contact and process documented in the Terms.

### P2-8. Backups, retention & disaster recovery

1. Daily automated backups + PITR; verify by **restoring to a scratch database every quarter** and running the smoke test (document in the runbook).
2. Targets: RPO ≤ 15 min, RTO ≤ 4 h (adjust with the human).
3. Retention: `review_logs` kept (needed for stats and future FSRS) but archived/compacted after N months if size becomes an issue; expired tokens purged; quiz sessions of anonymous players purged after 30 days; deleted accounts purged immediately (or after the grace period).
4. Backup encryption and access control; no production data in staging (use synthetic data).

---

## 8. Phase 5: Global & Growth (P2c / P3)

### P2-9. Payments & plans (only if you monetize)

**Stop and ask the human** about the pricing model first. Suggested: Free + Premium.

1. Entitlements: `plans` + `subscriptions(user_id, provider, plan, status, current_period_end, ...)`. Feature checks go through a single `EntitlementService` (e.g., AI limit, unlimited quiz players, themes).
2. Provider: a hosted checkout such as **Stripe** (cards and many local methods) or **Paddle/Lemon Squeezy** (merchant of record that handles VAT/sales tax globally). For Cambodia-specific methods (e.g., local bank/QR payment rails), research current provider support and ask the human; do not assume.
3. Webhooks: verify signatures, process idempotently, store raw event IDs; subscription state is derived from webhooks, never from the client.
4. UI: pricing page (EN/KM), upgrade prompts at limits ("You've used today's 10 AI helpers"), billing portal link, cancellation flow that is **easy** (no dark patterns), receipts by email.
5. Refund and cancellation policy in the Terms; tax handling documented.
6. Never block studying core features (reviewing your own cards) behind a paywall; premium adds convenience (AI quota, themes, bigger rooms).

### P2-10. Internationalization beyond English and Khmer

1. **Language selection by data:** choose the next languages by actual user geography/analytics, not guesswork.
2. **i18n structure:** namespaces per feature (`common`, `study`, `quiz`, `settings`, …), lazy-loaded per language (don't ship every language in the main bundle); ICU plural/select rules via i18next plural suffixes; **no string concatenation** for sentences; interpolation only.
3. **Localization pipeline:** a translation management tool (Crowdin, Weblate, or Lokalise) connected to the repo; context notes for translators; pseudo-localization mode (`en-XA`) in dev to catch hard-coded text and layout overflow; the CI parity check expands to all languages (every key present in every language, or an explicit fallback list).
4. **Formatting:** dates, numbers, relative time and lists through `Intl.*` using the user's locale; time zone from the profile; first day of week setting.
5. **RTL (Arabic, Hebrew, Persian, Urdu):** set `dir="rtl"` from the language; convert layout to **logical CSS** (`ms-`/`me-`/`ps-`/`pe-`/`start`/`end` Tailwind utilities, `text-start`), mirror directional icons (arrows, chevrons, progress), keep numerals/Latin runs bidi-safe (`<bdi>`), and test every screen.
6. **Fonts:** per-script subsets (Khmer, Thai, Devanagari, Arabic, CJK) loaded on demand by language.
7. **Backend content:** badge/quest/shop names currently exist in Khmer + English; structure them as translation tables or JSON keyed by locale, with English fallback.
8. **Emails and AI output** respect the user's language.
9. Add language to onboarding with auto-detection from `navigator.languages` (suggest, don't force).
10. Settings: language change applies instantly and persists to `PUT /me`.

### P2-11. Cards: import/export, images, duplicates, leeches

1. **Import:** CSV (columns: front, back, tags, optional type) with preview + column mapping; Anki `.apkg` (text-only cards first; media later); max rows/size limits; duplicate detection by normalized front text within the deck (offer "skip duplicates").
2. **Export:** CSV and JSON per deck; optional `.apkg` later.
3. **Images:** upload endpoint with strict validation: type allowlist (png/jpeg/webp), max 2 MB, re-encode server-side to strip metadata, store in object storage (S3-compatible) with random keys, served through the CDN; require `altText`; per-user storage quota; virus scan hook if feasible. `mediaUrl` accepts only URLs from your own storage host.
4. **Leech handling:** after N lapses (default 8) auto-flag the card as a leech and **suspend** it with a notification offering "Rewrite this card" or "Keep studying".
5. **Bulk operations:** move cards between decks, bulk delete, bulk tag.
6. **Card search** (see P1-4).

### P2-12. Explore (public decks)

Depends on P2-7 (moderation).
1. Migration for `deck_publications(deck_id, published_at, language, level, tags, title_snapshot, status)`; `POST /decks/{id}/publish`, `DELETE /decks/{id}/publish`, `GET /explore/decks?q=&subjectId=&language=&level=&page=`, `POST /decks/{id}/copy` (copies cards **without** scheduling state).
2. Published decks are **snapshots** or live-linked? Decide with the human (default: snapshot with an "Update published version" action).
3. Show author nickname only (never email), card count, language, "Preview" (first 10 cards) and "Add to my decks". Rate-limit copy actions.
4. Reporting from every deck card (P2-7).

### P3 items (do after beta feedback)

| ID | Item | Notes |
|---|---|---|
| P3-1 | **FSRS** as an optional scheduler | Keep SM-2 default; implement behind the existing pure-Java engine interface; run both on historic `review_logs` to compare; add shared test vectors |
| P3-2 | **Teacher/class mode** | Class codes, assignments, progress dashboard; privacy for minors |
| P3-3 | **2FA / passkeys** | TOTP + WebAuthn; recovery codes |
| P3-4 | **Native wrappers** | Capacitor for app stores; add native push; follow Apple/Google review policies (account deletion in-app is **required** by both stores, which P0-4 provides) |
| P3-5 | **Voice/read-aloud** | Web Speech API; Khmer TTS availability varies by device, so degrade gracefully |
| P3-6 | **Themes, seasonal events, friend streaks** | Opt-in only; calm mode must hide competitive elements |
| P3-7 | **Leaderboards (weekly, opt-in)** | Privacy-first, nickname-only, off by default for minors |

---

## 9. Cross-Cutting Engineering Standards

### 9.1 Backend

- **Layering:** Controller (HTTP only) → Service (business rules, transactions) → Repository. No business logic in controllers; no JPA entities in API responses (use DTO records).
- **Validation:** Jakarta Bean Validation on every request DTO with explicit max lengths (e.g., card front/back ≤ 5,000 chars, note ≤ 200 KB, nickname ≤ 20/40, tags ≤ 20 × 30 chars). Reject unknown JSON properties if safe to do so.
- **Transactions:** `@Transactional` at the service layer; read-only for queries; optimistic locking via `@Version` where concurrent edits matter; XP awarding in the **same transaction** as the review write so they can't diverge.
- **Time:** always `Instant`/`OffsetDateTime` UTC in the DB (`TIMESTAMPTZ`); convert with `ZoneId` only for "local day" logic; inject a `Clock` bean everywhere so tests can control time (**no `Instant.now()` in business code**).
- **IDs:** UUIDs; never expose sequential IDs.
- **Migrations:** one logical change per file; descriptive names `V16__email_verification.sql`; add indexes concurrently on big tables when needed (`CREATE INDEX CONCURRENTLY` requires non-transactional migrations; note it); every new FK has `ON DELETE` behavior chosen deliberately.
- **Error handling:** a single `@RestControllerAdvice` mapping exceptions to ProblemDetail with stable `code` values; never leak stack traces or SQL.
- **Config:** typed `@ConfigurationProperties` with validation; every property has a default or fails at startup; `.env.example` updated.
- **Testing:** unit tests for pure logic; integration tests with a real PostgreSQL (Testcontainers locally if Docker is available, service container in CI); test **authorization** explicitly for every endpoint (own data OK, other user's data 404, anonymous 401).
- **Performance:** avoid N+1 queries (`@EntityGraph`/fetch joins/DTO projections); verify with query counts in tests for the hot paths (review queue, deck list).

### 9.2 Frontend

- **Data flow:** server data via TanStack Query only; Zustand for UI state and the guest store only.
- **API access:** only through the generated typed client wrappers; never raw `fetch` for the API (except the STOMP client).
- **Forms:** one form pattern (e.g., React Hook Form + zod) with server `fields` errors mapped to inputs and focus moved to the first invalid field.
- **Components:** accessible primitives (e.g., Radix UI/Headless UI) for dialogs, menus, tabs, toasts; do not hand-roll focus traps.
- **Styling:** Tailwind with design tokens as CSS variables for light/dark; logical properties for RTL readiness.
- **State of every screen:** loading skeleton, empty, error + retry, offline, success (see doc §6.6). A shared `<AsyncBoundary>` helps keep this consistent.
- **Security:** never `dangerouslySetInnerHTML` without sanitization; no tokens in storage; no secrets in the bundle; CSP-compatible (no inline scripts).
- **Tests:** Vitest + Testing Library for components/hooks; Playwright for flows; i18n parity test; axe checks.
- **Bundle:** respect the budgets; PRs that grow the main bundle by > 10 KB gz need a justification.

### 9.3 Security checklist applied to every new endpoint

1. Authentication required? (Default yes.)
2. Ownership check on every ID parameter → `404` if foreign.
3. Input validation and size limits.
4. Rate limit appropriate to cost/abuse risk.
5. No sensitive data in logs or error messages.
6. Output encoded/sanitized where HTML may be rendered.
7. Idempotency for anything that grants rewards or charges money.
8. Tests: anonymous (401), other user (404), valid (200/201), invalid (400), over-limit (429 where applicable).

### 9.4 Git & PR conventions

- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- PR template: Summary, Screenshots (EN and KM), How to test, Migration notes, Risks/rollback, "Found but not changed", Checklist (definition of done).
- Protected `main`: required CI checks, one review, linear history.

---

## 10. Test Matrix (what must exist by launch)

| Area | Must-have tests |
|---|---|
| Auth | Register/login/refresh/logout; refresh rotation; reuse → family revoked; reset flow; verify email; rate limits; change password revokes others |
| Authorization | Every resource type: anonymous 401, other user 404 |
| SRS | Existing 28 unit tests plus shared vectors if ported to TS |
| Review | Idempotent replay; stale version 409; undo within and after the window; daily limits; study-ahead |
| Game | XP cap across all sources; coins; level-up; streak edge cases (midnight, timezone, DST); freeze rules; anti-abuse min time |
| Planning | CRUD for notes/exams/tasks/focus/boss; ownership; XP idempotency; daily session limit |
| Quiz rooms | State machine; host-only actions; late/duplicate answers; no early correct answers; reconnect; 100-player load |
| AI | Quota; malformed output; injection strings; budget ceiling; timeout/circuit breaker |
| Offline | Offline review → sync exactly once; logout clears cache; second user isolation |
| Account | Export completeness; deletion leaves no rows; device revocation |
| i18n | EN/KM parity; pseudo-locale; RTL snapshots (when added) |
| A11y | axe on all main pages, EN and KM; keyboard-only review flow |
| Performance | Lighthouse budgets; review queue query under load; stats queries on 100k rows |
| Security | Prod profile boot test (swagger off, no mail logger, guards); header checks; CSP; log redaction |
| E2E | New user journey A (first day), daily habit journey B, notes → card journey C, class quiz journey D |

---

## 11. Manual Steps Only the Human Can Do

Codex cannot do these. Track them in a checklist and tell Codex the results as configuration:

- [ ] Buy/choose the domain; configure DNS; HTTPS certificates.
- [ ] Create accounts: hosting, managed Postgres, Redis, CDN, email provider (SES/Postmark/…), error tracking, uptime monitor, translation platform, payment provider (if monetizing), Anthropic API key (with a spending limit set in the provider console).
- [ ] Configure SPF, DKIM, DMARC for the sending domain.
- [ ] Create Google OAuth credentials and register **one redirect URI per environment**.
- [ ] Generate VAPID keys for web push.
- [ ] Decide: minimum age & consent policy, deletion grace period, pricing, retention periods, target launch countries.
- [ ] Have the Privacy Policy and Terms reviewed by a qualified professional; have a native Khmer speaker review all Khmer copy and emails.
- [ ] App store developer accounts (Apple Developer, Google Play) if shipping native wrappers.
- [ ] Recruit 20–50 beta students; plan feedback sessions.

---

## 12. How to Drive Codex (Prompt Templates)

### 12.1 One-time setup prompt

> You are working in the Studexa repository. First read `AGENTS.md`, `STUDEXA_CODEX_BUILD_GUIDE.md` (especially Section 0), and `WEBSITE_AND_API_DOCUMENTATION.md`. Do not change any code yet. Reply with: (1) the real versions from `pom.xml` and `package.json`, (2) the list of Flyway migrations present, (3) the commands to run backend and frontend tests and whether they pass, (4) any contradictions between the documentation and the code. Then wait.

### 12.2 Per-task prompt template

> Implement task **{ID}: {Title}** from `STUDEXA_CODEX_BUILD_GUIDE.md`.
> Follow Section 0 (rules and definition of done).
> Steps: (1) Read the relevant existing code and list the files you will touch and any assumptions. **Show this plan before editing.** (2) Write the failing tests first. (3) Implement. (4) Run the full backend and frontend checks. (5) Update the docs and `.env.example`. (6) Summarize: what changed, how to test manually, risks, and "Found but not changed".
> If you hit any stop-and-ask trigger, stop and ask me.

### 12.3 Review prompt (run after each task, ideally in a fresh session)

> Review the diff of branch **{branch}** against `main` as a strict code reviewer for Studexa. Check against Section 0.2 (definition of done), Section 1.2 (invariants), and Section 9.3 (security checklist for new endpoints). List: bugs, missing tests, security issues, missing i18n keys (en/km), accessibility gaps, migration risks, and anything in the diff not required by task **{ID}**. Do not modify code; only report.

### 12.4 When Codex gets stuck or breaks something

1. Revert to the last green commit; don't pile fixes on top of a broken state.
2. Ask Codex: "State the exact failing command, the error, and your hypothesis. Propose two fixes and the risk of each. Do not change code yet."
3. Apply the smaller fix, re-run all checks.
4. If the same issue persists after two attempts, split the task into smaller tasks.

### 12.5 Human review checklist after each PR

- [ ] I ran the app and clicked through the changed feature in **both** English and Khmer.
- [ ] I tried it on a phone-sized screen and with keyboard only.
- [ ] I tried the failure paths (wrong input, offline, expired session).
- [ ] The migration looks safe on existing data.
- [ ] No secrets, no console logs of sensitive data, no leftover TODO hacks.
- [ ] CI is fully green, not just locally.

---

## 13. Launch Plan & Checklist

### 13.1 Order of release

1. **Internal alpha** (team only) after Phase 1.
2. **Closed beta** (20–50 students; Khmer and English) after Phase 2 + P2-1. Collect: crash reports, onboarding drop-off, D1/D7 retention, qualitative feedback. Run for 3–4 weeks and fix the top issues each week.
3. **Open beta** with feature flags (turn off live quiz hosting or AI if load/cost is a concern) after Phase 4.
4. **Public launch** (web first, PWA installable); app stores later via Capacitor (P3-4).

### 13.2 Final launch checklist

**Security & config**
- [ ] `JWT_SECRET` strong and unique per environment (rotated from any dev value)
- [ ] `JWT_COOKIE_SECURE=true`; `FRONTEND_URL` is HTTPS; CORS single origin
- [ ] Swagger off and tested; actuator limited
- [ ] No tokens/reset links/passwords in logs (tested)
- [ ] Dependency and secret scans pass; Dependabot enabled
- [ ] Rate limits live on Redis; `Retry-After` honored in the UI
- [ ] Security headers verified with an external scanner

**Product**
- [ ] Forgot/reset and email verification work end to end in production email
- [ ] All data (notes, plans, timer, boss) saved on the server and visible across devices
- [ ] Offline review syncs correctly (including on a low-end Android phone)
- [ ] Onboarding → first review under 2 minutes (median) on 4G
- [ ] Every screen has loading, empty, error and offline states
- [ ] EN/KM parity test passes; Khmer copy reviewed by a native speaker
- [ ] Accessibility checks pass; manual screen reader pass done

**Compliance**
- [ ] Privacy Policy, Terms, cookie notice published (EN + KM) and reviewed
- [ ] Age/consent policy implemented as decided
- [ ] Account deletion and data export work and are tested
- [ ] AI disclosure shown; AI can be disabled

**Operations**
- [ ] Backups and a **tested restore**
- [ ] Alerts configured and routed to a real person
- [ ] Runbook (deploy, rollback, incident, restore)
- [ ] Load test passed (review API; quiz room with 100 players)
- [ ] AI spend ceiling set at the provider and in the app
- [ ] Support email and in-app feedback link working
- [ ] Status page or a plan for communicating outages

**Growth**
- [ ] Landing page with SEO basics (title/description, Open Graph image, sitemap, `robots.txt`), fast and accessible
- [ ] Analytics funnel visible (signup → onboarding → first review → D7)
- [ ] Referral/share link and class-quiz sharing flow tested

---

## 14. Quick Reference: Suggested Task Order

1. **P0-A, P0-B, P0-C, P0-D** (audit, CI, answers, data-source inventory)
2. **P0-1** wire notes/plans/timer/boss to server
3. **P0-2** email, reset UI, verification
4. **P0-3** production hardening
5. **P0-4** account management
6. **P0-5** legal, consent, age *(needs human decisions first)*
7. **P0-6** feature flags, maintenance, version, 404
8. **P1-4** pagination/search/indexes *(before heavy list usage)*
9. **P1-2** game anti-abuse
10. **P1-1** quiz rooms
11. **P1-3** guest migration
12. **P1-5** AI hardening
13. **P1-7** stats endpoints
14. **P1-6** accessibility + Khmer typography
15. **P1-8** performance
16. **P1-9** analytics
17. **P2-1** offline/PWA
18. **P2-2** reminders
19. **P2-3** onboarding polish
20. **P2-4 → P2-8** scale, deploy, observability, moderation, backups
21. **Closed beta**
22. **P2-9 → P2-12**, then P3 items driven by feedback

Give Codex one item at a time, run the review prompt, do the human checklist, merge, and then continue.
