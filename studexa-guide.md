# Studexa Beta: Deployment, Keys, Features, and Community Guide

## 1. Current Situation

The agent reported:

- Studexa is now in a **private GitHub repository**, and backend and frontend GitHub Actions jobs passed.
- The **beta is still offline**. Deployment is blocked because the agent has no authenticated access to **Render** (hosting) or **Neon** (database).
- The local **Gemini key's free-tier status** still needs confirmation.
- Remaining checks once cloud access exists:
  - Hosted database restore
  - Six live Gemini runs before inviting testers

The agent later reported that `studexa-beta.onrender.com` returns "no server", and that `RENDER_API_KEY` and `NEON_API_KEY` are not visible to its session.

---

## 2. Why the Agent Can't See Your Keys

Environment variables set in one PowerShell window (for example `$env:RENDER_API_KEY="..."`) exist only in that window. The agent runs in a different process and cannot see them.

**Fix:** put the keys in a Git-ignored file the agent can read.

1. Open or create `backend/.env`:
   ```
   RENDER_API_KEY=rnd_xxxxxxxxxxxxxxxx
   NEON_API_KEY=napi_xxxxxxxxxxxxxxxx
   ```
2. Confirm it is Git-ignored:
   ```
   git check-ignore backend/.env
   ```
   - If it prints the path, it is ignored.
   - If it prints nothing, add `.env` to `.gitignore` **before** committing anything.
3. Tell the agent: "The keys are now in backend/.env."

**Never paste key values into chat.**

If you deployed through the Render dashboard instead, send the agent the real public app URL. Render may add a random suffix if a name is taken, so the real URL can differ from `studexa-beta.onrender.com`.

---

## 3. Public vs Private Keys

Neither Render nor Neon uses a public/private key pair. Each gives you **one secret token**.

| Item | Secret? | Where it belongs |
|---|---|---|
| Render API key (`rnd_...`) | Yes | `backend/.env` |
| Neon API key (`napi_...`) | Yes | `backend/.env` |
| Neon connection string (`postgresql://...`) | Yes (contains password) | `.env` or Render environment variables |
| Gemini API key | Yes | `.env` or Render environment variables, never in frontend code |
| App URL (`https://your-app.onrender.com`) | No | Fine to share |

You don't need an SSH key for this setup.

If a key leaks, delete it in the dashboard and create a new one.

---

## 4. How to Get the API Keys

### Render API key

1. Log in at `dashboard.render.com`.
2. Open your profile, then **Account Settings**.
3. Go to **API Keys**, then **Create API Key**.
4. Name it (for example `studexa-agent`) and confirm.
5. Copy it immediately. It is shown only once.

A Render key has the same access as your account. To limit that, create it under an account that only has the Studexa workspace.

### Neon API key

1. Log in at `console.neon.tech`.
2. Open your profile, then **Account settings**.
3. Go to **API keys**, then **Create new API key**.
4. Name it (for example `studexa-agent`).
5. Copy it immediately. It is shown only once.

---

## 5. Manual Deployment Checklist

If you prefer to deploy yourself:

1. **Neon:** create a project and copy the connection string.
2. **Restore the database** using the Deployment runbook (usually `pg_restore` or `psql` against the Neon URL).
3. **Render backend:** create a web service from the private GitHub repo and add environment variables (Neon URL, Gemini key, etc.).
4. **Render frontend:** create a static site and point it at the backend URL.
5. **Check the Gemini key** in Google AI Studio. Free-tier rate limits can make the six live runs fail, so wait between runs or enable billing.
6. **Run the six live Gemini tests** against the deployed app.
7. **Invite testers** only after everything passes.

---

## 6. Typical Features of an Education Web App

### For learners
- Accounts and login (email, Google), profile, password reset
- Courses or study material (lessons, notes, videos, PDFs)
- Quizzes and tests with instant scoring and explanations
- Progress tracking and weak-area dashboard
- Search and bookmarks
- Notifications and study reminders

### For teachers and admins
- Content management (courses, quizzes, assignments)
- Class and student management, roles and permissions
- Assignments and grading
- Analytics and exportable reports

### Engagement
- Gamification (points, badges, streaks, leaderboards)
- Discussion, forums, Q&A
- Live sessions and scheduling

### AI-powered (relevant to Studexa and Gemini)
- AI tutor or chatbot
- AI-generated quizzes and flashcards from notes or PDFs
- Summaries of long material
- Personalized study plans
- Spaced repetition

### Technical and business
- Responsive design, multi-language support, accessibility
- Secure handling of student data and privacy compliance
- Payments or subscriptions if the app is paid

### Suggested beta minimum
Login, study material or AI chat, quizzes, and progress tracking. Add the rest based on tester feedback.

---

## 7. Adding a Telegram Community Link

### Get the invite link
1. Create a Telegram **group** (everyone can chat) or **channel** (announcements only). A group is usually best for a community.
2. Open **Group info**, then **Invite Links**.
3. Copy the link: `https://t.me/yourgroupname` (public) or `https://t.me/+AbCdEfGh123` (private).

### HTML
```html
<a href="https://t.me/yourgroupname" target="_blank" rel="noopener noreferrer" class="telegram-btn">
  Join our Telegram community
</a>
```

### React
```jsx
<a
  href="https://t.me/yourgroupname"
  target="_blank"
  rel="noopener noreferrer"
  className="telegram-btn"
>
  Join our Telegram community
</a>
```

### Where to place it
- Navbar or footer
- Dashboard or sidebar after login
- Welcome or onboarding message
- A small banner: "Questions or feedback? Join our community."

### Optional improvements
- Add the Telegram icon next to the text.
- Store the link in an environment variable such as `VITE_TELEGRAM_URL`.
- For private groups, use a link with no expiry or user limit.
- Use Telegram group topics to split sections like "Help" and "Feedback".

### Prompt you can give the agent
> Add a "Join our Telegram community" button linking to https://t.me/YOUR_LINK in the navbar and footer. Read the URL from `VITE_TELEGRAM_URL`.

---

## 8. Reply You Can Send to the Agent

> I set them in a different PowerShell window. I've now put RENDER_API_KEY and NEON_API_KEY in backend/.env (Git-ignored). Please re-check, then continue with the database restore and the six live Gemini runs.

---

## 9. Security Reminders

- Never commit `.env` files or paste keys into chat.
- Keep the Gemini key on the backend only.
- Rotate any key that may have leaked.
- Give keys the minimum access they need.
