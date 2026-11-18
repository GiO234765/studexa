# Studexa

A gamified study web app for students (Khmer + English). Flashcards with spaced repetition,
a focus timer, notes, quizzes, and a game layer (XP, levels, streaks, pets, quests).

Built from `Studexa_Complete_Build_Guide_v2.md`, one step at a time.

## Stack

| Part | Technology |
|---|---|
| Backend | Java 21, Spring Boot 4, Spring Security, JPA, PostgreSQL, Flyway, Maven |
| Frontend | React + TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, i18next, openapi-fetch (typed client) |
| Local database | PostgreSQL 16+ installed locally (no Docker) + pgAdmin |

## Requirements

- JDK 21+
- Node.js 24 or 22.13+ (Vitest 5 requires Node 22+)
- PostgreSQL 16 or newer (with pgAdmin) installed locally
- Git

## Project layout

```text
.
├── backend/              Spring Boot API (package com.studexa)
├── frontend/             Vite React app
├── db/setup-local.sql    Creates the studexa role and databases (run once)
├── .env.example          Backend environment variables
├── DECISIONS.md          Notes about build choices
└── Studexa_Complete_Build_Guide_v2.md
```

## Database setup

The app uses a locally installed PostgreSQL. Create the login role and the two
databases once, as the `postgres` superuser:

```bash
psql -U postgres -f db/setup-local.sql
```

Or, in pgAdmin: right-click your server → **Query Tool**, paste `db/setup-local.sql`, and run it.

This creates:

| Database | Used by |
|---|---|
| `studexa` | Development (`./mvnw spring-boot:run`) |
| `studexa_test` | Tests only (`./mvnw test`) |

The `pg_trgm` extension is created automatically by the `V6` Flyway migration
(trusted extension, so the `studexa` owner can create it).

Verify:

```bash
psql -h localhost -U studexa -d studexa -c "SELECT 1;"
```

## Run locally

See the [private beta runbook](docs/BETA_RUNBOOK.md) for invitation management,
sample-only Gemini, deployment, and verification.

### 1. Start the backend

```bash
cd backend
./mvnw spring-boot:run
```

On Windows PowerShell/CMD use `mvnw.cmd spring-boot:run`.

Check it:

- `http://localhost:8080/api/v1/health` → `{"status":"ok","db":"up"}`
- `http://localhost:8080/actuator/health` → `{"status":"UP"}`
- `http://localhost:8080/swagger-ui.html` → API docs

The backend reads environment variables (see `.env.example`). Defaults point at the local
`studexa` database, so no extra setup is needed for local development.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. In development the Vite dev server proxies `/api` to
`http://localhost:8080`, so no CORS setup is required. You are redirected to `/login` until you
register or sign in. Registration signs you in, saves your onboarding profile to the backend, and
then opens the app.

Set `VITE_API_URL` in `frontend/.env.local` only if the backend is not reachable through the proxy:

```bash
cp frontend/.env.example frontend/.env.local
```

### Typed API client

The frontend calls the backend through a typed client generated from the backend's OpenAPI
document. `src/lib/api/schema.d.ts` is generated output; do not edit it by hand. Regenerate it
whenever the API changes (the backend must be running):

```bash
cd frontend
npm run api:generate
```

The hand-written `src/lib/api.ts` exposes feature APIs (`authApi`, `subjectsApi`, `decksApi`,
`cardsApi`, `reviewApi`, `aiApi`) built on the generated `client` in `src/lib/api/client.ts`. The
client attaches the in-memory access token, refreshes it once on a 401, and converts RFC 7807
errors into `ApiError`. Calling a path or request field that is not in the spec is a compile error.

The generator is pinned to TypeScript 5 in `frontend/tools/openapi-gen/` because openapi-typescript
uses the TypeScript compiler API, which is incompatible with the app's TypeScript 7. `npm run
api:generate` installs that isolated toolchain automatically.

## API

All endpoints are versioned under **`/api/v1`**. Errors use **RFC 7807** problem responses:

```json
{
  "type": "https://studexa.app/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "detail": "Please check the highlighted fields.",
  "fields": { "title": "must not be blank" }
}
```

### Authentication (Step 5)

| Method | Path | What it does |
|---|---|---|
| POST | `/auth/register` | Create an account; returns an access token and sets the refresh cookie |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/refresh` | Rotate the refresh token and return a new access token |
| POST | `/auth/logout` | Revoke the refresh token |
| POST | `/auth/forgot-password` | Always returns 202; the reset link is logged by the backend |
| POST | `/auth/reset-password` | Set a new password using the reset token |
| GET | `/me` | Current user and profile (requires `Authorization: Bearer <token>`) |
| PUT | `/me` | Partial profile update (nickname, avatar, language, timezone, goals) |

- Access tokens are JWTs valid for 15 minutes.
- Refresh tokens are HttpOnly cookies scoped to `/api/v1/auth`, valid for 30 days, and rotate on every refresh.
- After a successful Google login the browser is sent to `/auth/callback?accessToken=...` on the frontend.

#### Google login (optional)

1. Create an OAuth 2.0 Client ID (Web application) in the Google Cloud console.
2. Add an authorized redirect URI: `http://localhost:8080/login/oauth2/code/google`.
3. Set `GOOGLE_LOGIN_ENABLED=true`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`.
4. Restart the backend. With the flag off, the app starts normally without Google credentials.

### Subjects (Step 6)

All endpoints require `Authorization: Bearer <accessToken>`. Every query is scoped to the
logged-in user; another user's subject id returns **404**.

| Method | Path | What it does |
|---|---|---|
| GET | `/subjects?archived=` | List subjects; omit `archived` for all, or pass `true`/`false` |
| POST | `/subjects` | Create a subject (`name`, optional `color`, `icon`) |
| PUT | `/subjects/{id}` | Partial update (`name`, `color`, `icon`, `archived`) |
| DELETE | `/subjects/{id}` | Delete a subject |

### Decks and cards (Step 7)

All endpoints require `Authorization: Bearer <accessToken>` and are scoped to the logged-in user.

| Method | Path | What it does |
|---|---|---|
| GET | `/decks` | List decks with real card and due counts |
| POST | `/decks` | Create a deck (`title`, optional `description`, `subjectId`, `color`, `icon`) |
| GET | `/decks/{id}` | Get one deck |
| PUT | `/decks/{id}` | Partial deck update |
| DELETE | `/decks/{id}` | Delete a deck and its cards |
| GET | `/decks/{id}/cards` | List the cards in a deck |
| POST | `/decks/{id}/cards` | Create a card (`type`, `front`, `back`, optional `extra`, tags, source fields) |
| POST | `/decks/{id}/cards/bulk` | Create up to 100 cards in one request |
| PUT | `/cards/{id}` | Partial card update |
| DELETE | `/cards/{id}` | Delete a card |
| GET | `/cards/due?limit=50` | Due cards across all decks, with deck and subject metadata |
| POST | `/cards/{id}/review` | Record a rating (`AGAIN`, `HARD`, `GOOD`, `EASY`) and schedule the next review |

Card types are `BASIC`, `REVERSED`, `CLOZE`, and `MULTIPLE_CHOICE`. Multiple-choice cards keep their
choices and optional explanation in `extra`. New cards start due; the SM-2-style scheduler updates
ease, interval, reps, lapses, state, and `dueAt` after each review.

### Review session (Step 9)

| Method | Path | What it does |
|---|---|---|
| GET | `/review/queue?deckId=` | Ordered study queue with per-rating interval previews |
| POST | `/review/answer` | Apply a rating; updates progress with optimistic locking and logs the review |
| POST | `/review/undo?cardId=` | Restore the previous scheduling state for a card |

### Spaced repetition engine (Step 8)

The scheduling rules live in `backend/src/main/java/com/studexa/srs/` as pure Java with no
Spring, JPA, or web imports:

| Class | Purpose |
|---|---|
| `Sm2Scheduler` | Applies `AGAIN`, `HARD`, `GOOD`, and `EASY` to a `CardState` |
| `SchedulerConfig` | All constants: ease values, intervals, jitter, daily limits, study-ahead window |
| `StudyQueueBuilder` | Orders learning, review, and new cards and applies daily limits |
| `QueueOptions` | Per-session remaining new/review limits, study-ahead, starred-only |

Run the engine tests with:

```bash
cd backend
./mvnw -Dtest=Sm2SchedulerTest,StudyQueueBuilderTest test
```

### AI study generation and pet tutor

| Method | Path | What it does |
|---|---|---|
| POST | `/ai/generate` | Generate grounded flashcards or quiz questions |
| POST | `/ai/tutor` | Ask the floating AI study pet a question, optionally grounded in notes |

Set `ANTHROPIC_API_KEY` in the backend environment to enable AI. The key never reaches the browser
or the repository. If it is missing, both endpoints return **503** with code `AI_NOT_CONFIGURED`.
Requests are limited by `AI_DAILY_LIMIT` (default 10 calls per UTC day). References are returned
only when the model's `sourceExcerpt` is an exact substring of the supplied notes or deck text, so
the app never displays an invented citation.

## Frontend integration

- The access token is kept in memory; the HttpOnly refresh cookie restores the session after a reload.
- `/login` and `/register` are public. Everything under `/` and `/onboarding` requires a session.
- Onboarding finishes with `PUT /api/v1/me` before marking setup complete locally.
- `frontend/src/lib/api/client.ts` attaches the access token and retries a request once after refreshing an expired access token.

### Security notes

- Set a real `JWT_SECRET` (32+ bytes) outside local development.
- Set `JWT_COOKIE_SECURE=true` when the backend is served over HTTPS.
- Rate limiting for auth endpoints is configured with `AUTH_RATE_LIMIT_*` variables.

## Useful commands

The verified foundation and outstanding work are recorded in [docs/BASELINE.md](docs/BASELINE.md).
Resolved dependency versions are in [docs/VERSIONS.md](docs/VERSIONS.md).
In Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`, and
`./mvnw.cmd` for backend commands. Backend verification includes fresh-schema
and V17-upgrade migration regression tests against the dedicated test database.

| Command | What it does |
|---|---|
| `psql -U postgres -f db/setup-local.sql` | Create the local role and databases (once) |
| `cd backend && ./mvnw test` | Run backend tests against `studexa_test` (the TestDatabaseGuard blocks other databases) |
| `cd backend && ./mvnw spring-boot:run` | Run the API |
| `cd frontend && npm run dev` | Run the frontend dev server |
| `cd frontend && npm run build` | Type-check and build the frontend |
| `cd frontend && npm test` | Run frontend unit tests (Vitest) |
| `cd frontend && npm run api:generate` | Regenerate the typed API client from the backend OpenAPI spec (backend must be running) |

## Languages

All user-visible text lives in `frontend/src/locales/en.json` and `km.json`. Never hard-code
user-facing text in components.
