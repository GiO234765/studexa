# Frontend data-source baseline

Inspected 17 November 2026. These are code findings, not multi-device acceptance
results. `useApp` is the persisted Zustand store in `frontend/src/lib/store.ts`.

| Feature | Current source | Evidence / implication |
|---|---|---|
| Decks/cards | Server via TanStack Query; local for guests | `lib/study.ts`, `features/decks/` |
| Review | Server API; local guest behavior and offline support | `features/review/ReviewPage.tsx`, `lib/offlineDb.ts` |
| Notes | Mixed: server requests inside Zustand actions | `loadNotes/addNote/updateNote/deleteNote`, `features/notes/` |
| Exams/tasks | Mixed: server requests inside Zustand actions | `loadExams/loadTasks/addExam/addTask/toggleTask`, `features/planner/PlanPage.tsx` |
| Focus sessions | Mixed: server requests plus local state/reward updates | `loadFocusSessions/recordFocus`, `features/timer/TimerPage.tsx` |
| Boss fights | Mixed: server requests plus local state/reward updates | `loadBossFights/recordBoss`, `features/boss/BossPage.tsx` |
| Stats | Mixed: server XP/queue/decks/game state and local focus data | `features/stats/StatsPage.tsx` |
| Quests | Server Query hooks with client-triggered progress; local guest counters | `lib/study.ts`, `ReviewPage.tsx`, `lib/store.ts` |
| Shop/pet | Server Query data for accounts; local guest values | `features/profile/ProfilePage.tsx` |
| Profile | Mixed auth profile, server game data and local display preferences | `features/profile/ProfilePage.tsx`, `lib/auth.ts` |
| Settings | Local preferences plus account/auth actions | `features/settings/SettingsPage.tsx`, `lib/settings.ts` |

The guide's P0-1 premise is outdated: the five planning/activity entities already
have server API calls. The remaining work is moving account domain state out of
the persisted store, unifying typed API access, and validating isolation,
idempotency, conflict handling, and multi-device behavior. Avoid rebuilding
already present CRUD endpoints. Local XP updates still exist in account-mode
store actions and need an economy audit before claiming server authority.
