# Studexa private beta

Start with up to ten invited adults in Cambodia. Core study data stays in the beta database. Gemini uses only the English and Khmer samples bundled with the app. Use the Google AI Studio free tier with billing disabled. Share the HTTPS URL and invite codes directly with testers.

## Deploy

1. Put the source in a private Git repository. Exclude local environment files, logs, and build output.
2. Create a Neon Free PostgreSQL project in Singapore for the beta. Use its **direct** endpoint and a TLS-verified JDBC URL in `DB_URL`, such as `jdbc:postgresql://HOST/DBNAME?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory`. Set `DB_USER` and `DB_PASSWORD` separately. The database role needs to run Flyway migrations, including `pg_trgm`. [pgJDBC TLS settings](https://jdbc.postgresql.org/documentation/ssl/)
3. Connect the repository to a Render Blueprint using `render.yaml`. Keep the service on the Free plan and set `FRONTEND_URL` to its exact HTTPS origin without a trailing slash. Set `VITE_BETA_SUPPORT_EMAIL` to a monitored organizer address before inviting testers. The initial verification build can use the sign-in screen’s organizer-contact message while the address is pending. Store `GEMINI_API_KEY` in Render and leave billing disabled in AI Studio. The container activates the Spring production profile and packages the frontend from source.
4. Deploy manually after CI passes. Verify `/actuator/health/liveness` and `/api/v1/health`. The former checks the app process and allows the database to idle. Check sign-in, refresh, and a direct link such as `/study/decks` or a saved `/notes/<id>`. Render and Neon can cold-start after idle periods.
5. Make one request for each of the three Gemini features in each language using a test account. Verify the tutor’s quote against the sample, add a generated card to a deck, and finish a solo generated quiz. Keep the beta closed to testers until these checks and a restore drill pass.
6. Open **Study → Live Rooms** with two invited test accounts. Share the host’s room link, start the quiz, and refresh the player’s page during a question. Confirm that both accounts can finish and see the leaderboard. The reverse proxy must pass WebSocket upgrades at `/ws/quiz`.

## Manage invitations

On a trusted operator machine, configure `PGHOST`, `PGDATABASE`, and `PGUSER` for Neon’s direct endpoint. Set `PGSSLMODE=verify-full` and `PGSSLROOTCERT` to your trusted CA bundle. Recent PostgreSQL clients also support `PGSSLROOTCERT=system`. Use a protected PostgreSQL password file for authentication. If `psql` is outside PATH, set `BETA_PSQL` to its executable path. [PostgreSQL TLS settings](https://www.postgresql.org/docs/current/libpq-connect.html)

```sh
node scripts/beta-invites.mjs issue tester@example.com
node scripts/beta-invites.mjs revoke tester@example.com
```

The issue command prints the code once and replaces any outstanding code for that email. The code expires after seven days. Revocation affects unused invitations. For sign-in assistance, testers contact the organizer at the address on the sign-in screen. Set `BETA_REGISTRATION_OPEN=false` in Render to stop new registrations while allowing current testers to sign in.

## Monitor and recover

- Check Render workspace usage, Neon compute and storage, and AI Studio quota during the beta. Keep the default Gemini quota at ten requests per account per UTC day or lower it with `AI_DAILY_LIMIT` if the project reaches provider limits.
- Before inviting testers, before deployments with migrations, and weekly during the beta, take a logical backup. Use PostgreSQL client tools at least as recent as the server. Pipe the dump through `age` with the operator’s public recipient key and store the encrypted file outside Render. Keep the private key separately.

  ```sh
  set -o pipefail
  pg_dump --format=custom --no-owner --no-acl | age -r "$BETA_BACKUP_RECIPIENT" -o studexa-beta.dump.age
  age -d -i "$BETA_BACKUP_IDENTITY" studexa-beta.dump.age |
    pg_restore --exit-on-error --no-owner --no-acl --dbname=studexa_beta_restore
  ```

  Run the restore against a newly created, empty scratch database with separate connection settings. Check Flyway history, sign-in, and representative study records there. Never use the live beta database as the drill target.
- For an app regression, redeploy the last passing Render release after checking schema compatibility. If a migration prevents rollback, restore to a fresh database, verify it, then switch the Render database settings. Preserve the failed database until the recovery is verified.

## Local beta

Set `VITE_TELEGRAM_URL` in the frontend environment or in Render before building to add a Telegram link to the workspace navigation and footer. The value is public in the frontend build. Use a public group URL for the build and share any private beta group invite directly with testers.

Use a dedicated test database and keep the Gemini provider disabled for automated tests. Start the backend with `BETA_ENABLED=true`, then run Vite with `VITE_BETA_ENABLED=true`. Optionally set `VITE_BETA_SUPPORT_EMAIL` to preview the contact link. Set the backend’s `FRONTEND_URL` to the exact origin you open in the browser, including the host and port. Vite proxies to port 8080 by default. For a backend on another port, set `STUDEXA_DEV_API_ORIGIN` when starting Vite.

Run `npm run test:beta` from `frontend` with the local app running and the operator PostgreSQL variables pointing to the same dedicated database. The database name must end in `_test`. Set `BETA_E2E_URL` if Vite uses a different local port and `BETA_E2E_BROWSER=chrome` to use an installed Chrome instead of Playwright Chromium. The browser tests send real requests for invitations, notes, deck and card saves, review, planning, and focus sessions. Gemini uses fixtures in this test.
