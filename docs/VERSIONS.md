# Verified dependency baseline

Inspected 17 November 2026. No dependencies were upgraded. Frontend resolved
versions come from `frontend/package-lock.json`, rather than its semver ranges.

| Component | Version |
|---|---|
| Java target | 21 |
| Spring Boot | 4.1.2 |
| Maven wrapper distribution | 3.10.0 |
| Flyway (Spring Boot dependency management) | 12.4.0 |
| springdoc | 3.2.0 |
| React | 19.3.1 |
| Vite | 8.3.8 |
| TypeScript | 7.0.2 |
| Tailwind | 4.3.5 |
| STOMP | 7.5.0 |
| qrcode.react | 4.2.0 |
| oxlint | 1.93.0 |
| Dexie | 4.4.7 |
| vite-plugin-pwa | 2.0.0 |
| Vitest | 5.1.0 |
| Playwright | 1.65.0 |

Local validation uses Node 24.13.1 and Temurin Java 21.0.11. Use Node 24,
or Node 22.13+; the guide's Node 20 suggestion does not satisfy Vitest 5.
CI uses Node 22 (latest patch). PostgreSQL 16 is the CI service version.

Migrations present: V1 through V17 at intake, plus V18 added in this foundation
pass. Always inspect the migration directory before assigning the next number.
