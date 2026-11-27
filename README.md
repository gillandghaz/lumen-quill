# Lumen Quill

A private, invitation-only archive of dated notes. Two display modes:

| Mode | Character |
|---|---|
| **Sonata** | Modern and celestial: night sky, aurora haze, ivory type, gold filaments, thin HUD lines, bracketed panels |
| **Palace** | Classic European court: silver vellum, royal navy ink, gilded double rules, engraved serif capitals, a ruled page |

## How notes work

- A note is made of **dated sections** (`YYYY-MM-DD`, in the writer's own time zone).
- **Write today** on the same day → continues the latest note (cursor after the last character, on a new line).
- **Write today** on a later day → by default asks: *continue* (adds today's section below the earlier days) or *start a new note*. Preferences can make either choice automatic.
- **Only today's section can be written.** Earlier days are locked (read-only, deletable); to change one, export, edit and import it as a new note.
- **New note** always creates a separate note.
- Typing autosaves (debounced) with a visible status (*Saving…* → *All changes saved*), retries offline, refuses to overwrite a newer version from another tab, and the browser asks before you leave while a save is still pending.

## Export / import

Plain `.md` or `.txt` (same structure, both tiny):

```
# Journal

## 2026-11-26

First day...

## 2026-11-27

Second day...
```

Several notes in one file are separated by a line `<!-- lumen:note -->`. Imported files always become new notes; text outside a date heading is dated today. Imports take any number of files (up to 1,000 / 50 MB at once) or a whole folder, are sent in chunks with a progress bar, and skip notes whose exact content was imported before.

## Stack

Next.js 16 (React 19, TypeScript) on **Vercel** (`sin1`) · **Firebase Auth** (Google + e-mail/password) · **Cloud Firestore** (`asia-southeast1`, Spark plan) · GitHub for versioning and CI.

```
app/       routes (pages + thin API route files)
server/    everything that runs only on the server (Admin SDK, sessions, security, services)
client/    browser code (components, theme, Firebase client SDK in client/auth only)
shared/    pure code used by both (schemas, dates, Markdown interchange)
tests/     vitest
```

Layer boundaries are enforced by ESLint (e.g. the Admin SDK may only be imported in `server/firebase.ts`).

## Accounts

There is **no public sign-up**. Exactly one administrator is created (from `ADMIN_EMAIL` / `ADMIN_USERNAME` in the secrets file) with:

```
node --env-file=<secrets file outside the repo> scripts/bootstrap-admin.mjs
```

The admin creates every other account in **Settings → Admin → Accounts** and manages security, the audit log, retention, backups and statistics there.

## Layout

- **Top bar** (fixed): brand on the left, profile photo on the right → *Home*, *Settings*, *Sign out*.
- **Home** (`/home`): *Overview* (today, totals, streak, recent notes), *Notes* (every dated entry, newest first), *Archive* (the list of notes, 15 per page). Which tab opens first is a preference.
- **Settings** (`/settings`): *Account* (photo, unique username, password reset link or create a password, sessions), *Preferences*, *Data* (export / import / delete all), *Admin* (admin only).
- Signed-in visitors of `/` or `/login` go straight to Home; signed-out visitors of any app page go to sign-in.

## Development

Every change goes through a branch and a pull request; see [CONTRIBUTING.md](CONTRIBUTING.md).

```
npm ci
git config core.hooksPath scripts/hooks
node --env-file=<secrets file> scripts/with-env.mjs dev
npm run lint && npm run typecheck && npm test && npm run build && npm run audit:deps
```

Secrets never live in this folder (no `.env.local`). Variable names: [.env.example](.env.example). Security model: [SECURITY.md](SECURITY.md).

## Deploy

Push to `main` → Vercel builds and deploys. Environment variables are set in the Vercel project (Production).
