# AI study experience improvements

Implemented 17 November 2026, building on the existing tutor and card generator.

## Student experience

- Open a note and choose **Study with AI**. Selected text is attached when there
  is a selection; otherwise the current editor text is attached, including unsaved
  edits. Rich-text markup is excluded. Nothing is sent until **Send** is pressed.
- Choose Explain simply, Key points, Practice question, or Give me a hint to draft
  a localized prompt. Students can edit it before sending.
- Inspect source quotes in expandable reference panels. Standard follow-ups send up
  to three successful turns to help the provider understand the question. In beta,
  the provider receives only approved prompts and text from the selected sample.
- The tutor keeps its thread while you navigate or close the panel. New chat,
  reloading, and signing out clear browser-memory history. Sending with a changed
  attachment or selecting another beta sample starts a new thread.
- Failed requests can be retried with their original question/source snapshot.
  Retry does not duplicate the displayed question. Automatic retries are disabled.
- Guest mode cannot send tutor requests. Offline drafts remain in component memory
  until reconnecting; refreshing the page discards them. Requests in flight can
  still fail on connection loss and can be retried manually.
- Clear removes the conversation and attached notes. Changing accounts remounts
  the tutor so another account cannot see the previous account's draft or answers.
- Question, source title and attached text inputs have explicit limits. The note
  shortcut warns when a source exceeds the 12,000-character attachment limit.
- Labels, prompts, disclosure, errors and status messages are present in EN/KM.
  Khmer copy still needs native-speaker review.

## Backend reliability

- `GEMINI_ENABLED` now actually controls Gemini availability. It defaults to false,
  matching `.env.example`. Gemini requires both enablement and a nonblank key;
  otherwise a configured Anthropic client is used. Model identifiers and
  dependency versions have not changed.
- AI quota dates use the injected Clock in UTC, allowing deterministic tests.
- Invalid/blank cards and quizzes without 3–4 unique choices are rejected.
  Invalid multiple-choice flashcards retain the existing BASIC fallback behavior.
- Tutor answers are limited to 6,000 characters. Raw model responses over 100,000
  characters are rejected before JSON parsing. Invalid results refund the claimed
  daily quota slot; a provider may still bill for the underlying failed response.
- Source quotes must be exact, case-sensitive substrings. Reference titles use the
  attached source title rather than a model-invented title. Tutor references are
  deduplicated and capped at five.
- Tutor instructions request the question's language, preserve Khmer, guide hints,
  and ask the model to acknowledge missing source information. These instructions
  improve behavior but are not a guarantee of factual accuracy.

The standard tutor accepts an optional `history` field and the beta tutor accepts
optional `previousPromptIds`. Existing clients can omit both fields. Quota size,
database schema, and XP economy are unchanged.

## Verification

- Backend `mvnw.cmd -B verify`: 78 tests pass, executable JAR builds.
- Frontend lint and 15 unit/component tests pass; TypeScript/Vite/PWA build passes.
- New backend coverage: enablement switch, blank cards, oversized tutor answer,
  exact citations/trusted titles, quiz choice count, quota refund with a fixed clock.
- New UI coverage: explicit send after note attachment, retry snapshot and no
  duplicated question, guest request prevention, offline/reconnect, account isolation.
- Browser preview was unavailable (native computer-use pipe missing). Visual,
  screen-reader and mobile checks remain outstanding. No billable provider call
  was made; provider quality, connectivity and model availability are unverified.

## Manual check

1. Restart the backend and frontend. Sign in, open a note, select a passage and
   choose Study with AI. Confirm the attached text before sending.
2. Try all four prompts in English and Khmer. Inspect a returned source quote.
3. Simulate a failed request, edit the attachment, and retry: the retry should use
   the original source. A new question should use the edited attachment.
4. Go offline, type a question, reconnect, and send. Switch accounts and confirm
   the previous draft and answers are absent.

Future work remains: a usage/reset display endpoint, server-side conversation
history with retention decisions, broader provider-response fixtures, and AI spend
budgets. Existing note autosave and card creation flows were not refactored here.
