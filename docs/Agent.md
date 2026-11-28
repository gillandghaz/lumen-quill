# Agent.md: continuing Lumen Quill with an AI assistant

> This document must be updated with every change that affects its rules, decisions or open work.

## 1. Starting prompt (copy this)

```text
You are a senior engineer and security reviewer continuing the project "Lumen Quill".
Read docs/Agent.md completely before answering, then README.md and the docs/ files relevant to my request.

WORKING STYLE
- Be sceptical and check facts (versions, advisories, provider behaviour) against official sources.
- Say plainly what was tested and what was not. Never invent results.
- If my request is risky or conflicts with the rules below, say so and propose an alternative first.

RULES
- Every change: branch -> pull request -> green CI -> merge. Never push to main.
- Keep npm audit at 0 vulnerabilities; pin exact versions.
- Update the affected docs and CHANGELOG.md in the same pull request.
- No secrets in the repository; secrets live in a file outside it.

MY REQUEST
...
```

## 2. Project in one paragraph

Lumen Quill is a private, invitation-only journal of dated notes.
- **Stack:** Next.js 16 (React 19, TypeScript) on Vercel `sin1`, Firebase Auth, and Cloud Firestore `asia-southeast1` (Spark plan).
- **Server:** the server is the only party that touches Firestore; rules deny every client.
- **Modes:** two display modes, Sonata (modern) and Palace (classic).
- **Language:** the interface and the docs are in English.

## 3. Decisions by the owner (do not change without asking)

| Area | Decision |
|---|---|
| Accounts | No public sign-up. Exactly one administrator (set by `scripts/bootstrap-admin.mjs`); the admin creates every other account |
| Sign-in | Google or e-mail + password; passwords change only through the reset e-mail; Google-only accounts may create one |
| Writing | Same day: continue only. New day: continue (new section) or new note; preference "A new day" (Ask default). Earlier days are locked (no editing; deleting a day is allowed). Older notes open read-only with "Continue this note today". Empty notes are deleted |
| Home | Tabs Overview, Notes (dated entries), Archive (notes by creation date, 20 per page, page jump). "Open on" preference; Home always returns there |
| Formatting | `**bold**` / `*italic*` live while typing, markers small and faint; hidden on locked days |
| Export / import | `.md` / `.txt` (same format), export ordered by creation date, dated file names; import of any number of files or a folder, chunked, de-duplicated |
| Admin | Accounts (scroll after 5, 10 per page, confirmations), Statistics, Security, Audit log, Backup (everything or date range); statistics and audit auto-delete after 1/3/7/30 days |
| Quota | Keep Firestore reads and writes minimal: caches, throttled autosave, no prefetch on note links, bounded retries, heavy-read limits |
| UI | Smooth transitions everywhere; dialogs centred, no scrollbars; fixed top bar; buttons lock while busy (no double actions) |
| Infrastructure | Server close to Indonesia: Vercel `sin1` + Firestore `asia-southeast1`. No Docker needed |
| Repository | Public, all rights reserved. No owner e-mail anywhere. Commits: author and committer = the owner's GitHub account with its no-reply address (`<id>+<owner>@users.noreply.github.com`), plus the trailer `Co-authored-by: Lumen Quill <dev@lumen-quill.invalid>`. The username appears only in LICENSE (copyright holder) and commit metadata, never in docs or screenshots. Commit dates are set to the next day |

## 4. Architecture rules

See [Architecture.md](Architecture.md).
- The Admin SDK is imported only in `server/firebase.ts`, and the Firebase client SDK only in `client/auth`. ESLint enforces both.
- Mutations go through `writer()`: Origin, then session, then rate limit. Use a strict Zod schema and get the owner from the session.
- New queries need an index in `firestore.indexes.json`, deployed before the pull request is merged.

## 5. Checks before a pull request

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run audit:deps
```

## 6. Open work / ideas (not started)

- MFA / App Check (needs paid Identity Platform / configuration).
- Scheduled automatic backups.
- Restore from a JSON backup inside the app.
