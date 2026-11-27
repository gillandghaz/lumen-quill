# Lumen Archive

A private, invitation-only archive of dated notes. Two display modes:

| Mode | Character |
|---|---|
| **Sonata** | Modern and celestial: night sky, aurora haze, ivory type, gold filaments, thin HUD lines, bracketed panels |
| **Palace** | Classic European court: silver vellum, royal navy ink, gilded double rules, engraved serif capitals, a ruled page |

## How notes work

- A note is made of **dated sections** (`YYYY-MM-DD`, in the writer's own time zone).
- **Write today** on the same day → continues the latest note.
- **Write today** on a later day → by default asks: *continue* (adds today's section to the latest note) or *start a new note*. Settings can make either choice automatic.
- **New note** always creates a separate note.
- Typing autosaves (debounced), retries offline, flushes when you leave, and refuses to overwrite a newer version from another tab.

## Export / import

Plain `.md` or `.txt` (same structure, both tiny):

```
# Journal

## 2026-11-26

First day...

## 2026-11-27

Second day...
```

Several notes in one file are separated by a line `<!-- lumen:note -->`. Imported files always become new notes; text outside a date heading is dated today.

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

There is **no public sign-up**. Exactly one administrator (`gillandghaz`) is created with:

```
node --env-file=<secrets file outside the repo> scripts/bootstrap-admin.mjs
```

The admin creates every other account in **Admin → Accounts** and manages security, backups and statistics there. Every account has Archive, Account, Settings and Data.

## Development

```
npm ci
node --env-file=<secrets file> node_modules/next/dist/bin/next dev
npm run lint && npm run typecheck && npm test && npm run build && npm run audit:deps
```

Secrets never live in this folder (no `.env.local`). Variable names: [.env.example](.env.example). Security model: [SECURITY.md](SECURITY.md).

## Deploy

Push to `main` → Vercel builds and deploys. Environment variables are set in the Vercel project (Production).
