# Security

> **Principle:** every claim has a status. "Coded" is not the same as "proven on the live service".

## Contents

1. [Trust boundary](#1-trust-boundary)
2. [Assets, threats and controls](#2-assets-threats-and-controls)
3. [Provider and repository settings](#3-provider-and-repository-settings)
4. [Audit for 1.0.0](#4-audit-for-100)
5. [Known gaps](#5-known-gaps)
6. [Tests](#6-tests)
7. [Periodic checklist](#7-periodic-checklist)
8. [Incident procedures](#8-incident-procedures)

---

## 1. Trust boundary

```
Browser (untrusted)
   │  HttpOnly session cookie · Origin header · JSON
   ▼
Vercel server (trusted)          the only holder of secrets
   ├─► Firebase Auth   who is this? (session cookie, custom claim)
   └─► Firestore       all data, through the Admin SDK (rules deny every client)
```

- The browser never holds a server secret and never talks to Firestore.
- The Firebase web API key is public by design. It is restricted to the app's domains and to the two Auth APIs.
- Every access decision is taken on the server from the verified session, never from client input.

## 2. Assets, threats and controls

| Asset | Threat | Control | Code |
|---|---|---|---|
| Notes | Reading or changing someone else's notes (IDOR) | Owner from the session; other users' notes answer **404**; ids are random 22 characters | `server/services/notes.ts` |
| Notes | Rewriting the past | Only today's section is writable; server-side "today" from the user's time zone; `403 day_locked` | `saveEntry` |
| Notes | Two tabs overwriting each other | `baseUpdatedAt` guard → `409 conflict` | `saveEntry` |
| Accounts | Strangers signing up | No sign-up UI; Firebase self sign-up blocked; a session requires an admin-created profile; a self-created Firebase account without one is deleted | `server/http/auth-handlers.ts` |
| Accounts | Stolen session | `__Host-` HttpOnly, Secure, SameSite=Lax cookie, 24 h; signature checked on every request; revocation and *disabled* checked at least every 60 s; ID token must be ≤ 5 min old | `server/auth.ts`, `server/http/cookies.ts` |
| Accounts | E-mail changed elsewhere (leaked password) | E-mail cannot change in the app; a different Firebase e-mail refuses sign-in and is audited | `createSession` |
| Accounts | Password takeover inside a session | Passwords are never changed in the app (reset link only). Creating one for a Google-only account needs a sign-in ≤ 10 min old and revokes every session | `server/http/account-handlers.ts` |
| Admin | Privilege escalation | Exactly one admin, set by script; requires the custom claim **and** the profile role (a mismatch refuses sign-in); cannot target itself or another admin | `server/session.ts`, `server/services/admin.ts` |
| Mutations | CSRF | `Origin` must equal `APP_ORIGIN`; `Sec-Fetch-Site` must be `same-origin` when present; SameSite=Lax cookie | `server/security/csrf.ts` |
| Input | Injection, mass assignment, oversized bodies | Strict Zod schemas (unknown keys refused); JSON content type required; byte limits checked before reading; control characters stripped | `shared/schemas.ts`, `server/http/respond.ts` |
| Pages | XSS | No raw HTML (lint rule); Markdown rendered to React elements; nonce-based CSP with `strict-dynamic`, no `unsafe-inline` / `unsafe-eval` scripts | `proxy.ts`, `client/components/Markdown.tsx` |
| Pages | Clickjacking, sniffing, leaks | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, nosniff, HSTS preload, COOP, CORP, Referrer-Policy, Permissions-Policy | `next.config.ts` |
| Downloads / photos | Rendered as a document | `Content-Disposition: attachment`; photos `image/jpeg` + nosniff + CSP `default-src 'none'; sandbox`; JPEG magic bytes checked | `server/http/respond.ts`, `server/services/avatar.ts` |
| Availability | Exhausting the free Firestore quota | Token verified before any write at sign-in; per-user / per-IP rate limits; heavy-read limits (search, deep pages, export, statistics); caches; throttled autosave; bounded retries | `server/security/rate-limit.ts`, `client/lib/api.ts` |
| Imports | Duplicates, oversized or future-dated data | Chunks re-validated (≤ 50 notes, 1.5 MB); days must be real and not after today; content fingerprint skips duplicates; account quota | `server/http/data-handlers.ts` |
| Logs / audit | Personal data leaks | Logs carry error names and codes; audit stores ids, codes and counts; retention 1/3/7/30 days | `server/services/audit.ts` |
| Secrets | Leaked keys | Only in Vercel (`sensitive`) and a file outside the repo; gitleaks in CI (full history) and pre-commit | `.gitleaks.toml`, `.github/workflows/ci.yml` |
| Dependencies | Vulnerable packages | Exact pins; `npm audit` at any severity and OSV-Scanner in CI; Dependabot alerts and security updates; `jose` pinned to 5.x for the runtime | `package.json` |
| Change control | Unreviewed changes in production | Branch → PR → green CI → merge; pre-push hook; `pr-only` CI job; rulesets kept in `.github/rulesets/` | `CONTRIBUTING.md` |

## 3. Provider and repository settings

Checked on 28 November 2026.

| Where | Setting | Value |
|---|---|---|
| Firebase Auth | Self sign-up | Blocked |
| Firebase Auth | Self account deletion | Blocked |
| Firebase Auth | E-mail enumeration protection | On |
| Firebase Auth | Password policy | Enforced, minimum 12 |
| Firebase Auth | Anonymous / phone sign-in | Off |
| Firebase Auth | Authorized domains | `localhost`, Firebase domains, the production domain |
| Google Cloud | Browser API key | Referrers: production domain, `*.firebaseapp.com` of the project, `localhost:3000`; APIs: Identity Toolkit, Token Service |
| Firestore | Rules | Deny all clients |
| Vercel | Secret variables | `sensitive`; production only; previews fail closed |
| GitHub | Dependabot alerts and security updates | On |
| GitHub | Actions | Token read-only; cannot approve PRs; only GitHub-owned actions and the OSV action allowed (pinned by SHA) |
| GitHub | Merge | Merge or squash; branches deleted after merge; no auto-merge |
| GitHub | Rulesets | Defined in `.github/rulesets/`: `main` needs a PR and green CI, no force push or deletion; `v*` tags immutable; `release/*` protected. Enforced once the repository is public, via `scripts/apply-rulesets.mjs` |

## 4. Audit for 1.0.0

A full review of the code, the configuration and the live providers (not a penetration test), done on 28 November 2026.

### Findings and fixes

| # | Finding | Impact | Status |
|---|---|---|---|
| A1 | Sign-in wrote a rate-limit counter **before** verifying the ID token | Anyone could spend the daily write quota with junk tokens | **Fixed**: token verified first; only genuine tokens reach the database |
| A2 | Search (500-note scan), deep archive / notes pages (offset reads) and export could be repeated freely | One account could exhaust the daily read quota for everyone | **Fixed**: search scans 300 and is limited to 20 / 10 min; deep pages and statistics share a heavy-read limit; export 10 / hour |
| A3 | Admin account list called `getUsers` with more than 100 ids | Error beyond 100 accounts | **Fixed**: batches of 100 |
| A4 | CSP allowed an unused image host | Needless surface | **Fixed**: removed |
| A5 | Browser API key usable from any site for 27 Google APIs | Abuse of the project's quotas from elsewhere | **Fixed**: referrer-restricted, two APIs; verified that other sites get "referer blocked" |
| A6 | Dependabot alerts off | New advisories unnoticed | **Fixed**: alerts and security updates on |
| Q1 | Autosave could save every 1.2 s (≈ 4 reads + 4 writes each) | Thousands of writes per writing session | **Fixed**: 2.5 s pause, ≥ 10 s apart, in-memory limiter (saves 2 operations per save) |
| Q2 | Overview scanned the last 60 entries for the streak | ≈ 68 reads per Home visit | **Fixed**: streak stored on the profile; ≈ 8 reads |
| Q3 | Session watcher polled every 60 s | ≈ 1,440 reads per tab per day | **Fixed**: every 5 min (actions still re-check) |
| Q4 | Failed autosave retried every 5 s forever | A request loop during an outage | **Fixed**: back-off up to 2 min, stops after 8 tries |
| Q5 | Note links prefetched (one server render each) | ≈ 20 hidden reads per Archive page | **Fixed**: no prefetch on note links |
| Q6 | No client cache: every tab switch re-read Firestore | Repeated reads | **Fixed**: 60 s GET cache cleared by any change; 30 s router cache; 15 s profile cache on the server |
| D1 | Double clicks could create two notes or start two exports | Duplicates, extra reads | **Fixed**: buttons lock while busy; identical in-flight mutations are shared; export locks for 4 s |
| C1 | The `pr-only` CI job could fail seconds after a merge | False alarm | **Fixed**: retries, then verifies the PR's merge commit |
| R1 | Repository and history contained the owner's e-mail and username | Personal data in a public repository | **Fixed**: files neutralised; history authorship rewritten before publication |

### Checked without findings

- **Authorisation:** all 37 handlers in 28 route files are guarded (mutations: Origin → session/admin → rate limit; reads: session/admin; cron: secret). No IDOR found.
- **XSS:** no `dangerouslySetInnerHTML`; every user text is a React text node; the live-formatting mirror keeps exactly the typed characters (tested).
- **Open redirect:** no redirect target comes from input.
- **Secrets:** gitleaks over the whole history: no findings; `.env*` ignored; secrets only in Vercel and a file outside the repo.
- **Loops:** every server loop is bounded (purges ≤ 20 passes, note deletion ≤ 100 passes, backup ≤ 400 pages, import retries ≤ 3); no unbounded client polling.
- **Dependencies:** `npm audit`: 0 vulnerabilities; OSV-Scanner clean in CI.

## 5. Known gaps

| Item | Note |
|---|---|
| MFA, App Check | MFA needs Identity Platform (paid); App Check not configured |
| Per-session logout | Firebase session cookies cannot be revoked one by one. "Sign out" clears the cookie; "Sign out everywhere" revokes all |
| Quota exhaustion by a signed-in account | Limited by rate limits and caches, not eliminated; accounts are admin-created only |
| Scheduled backups | Manual (Admin → Backup) |
| Ruleset enforcement while private | GitHub Free cannot enforce rulesets on private repositories; the workflow, hooks and CI keep the rule |

## 6. Tests

`npm test` covers, among others:
- CSRF, cookies, body limits and error responses;
- the rate limiter, including in-memory rules;
- configuration that fails closed, and the CSP;
- schemas and import chunks, the import fingerprint;
- Markdown interchange and the live-formatting mirror;
- renderer termination on odd input;
- the profile cache;
- documentation consistency.

Every new security rule needs a negative test.

## 7. Periodic checklist

- [ ] Two-factor sign-in on GitHub, Google (Firebase), Vercel.
- [ ] CI green on `main` (verify, gitleaks, OSV, pr-only).
- [ ] **Admin → Security**: all checks green.
- [ ] Firebase console → Usage: reads and writes far below the daily limits.
- [ ] Recent backup stored encrypted outside the cloud account.
- [ ] Rotate secrets when anyone stops being trusted.

## 8. Incident procedures

**A secret leaked: assume it was abused.** Revoke or rotate it at the provider first, then clean the history.

| Secret | Rotation |
|---|---|
| `FIREBASE_PRIVATE_KEY` | Google Cloud IAM → service account → new key → update Vercel → redeploy → delete the old key |
| `RATE_LIMIT_SECRET`, `CRON_SECRET` | New random value → update Vercel → redeploy |
| Browser API key | Not secret, but if abused: create a new restricted key → update `NEXT_PUBLIC_FIREBASE_API_KEY` → redeploy → delete the old key |

**An account is compromised.**
1. **Admin → Accounts → Disable**. The account is refused within a minute.
2. If the scope is unclear, use **Admin → Security → Sign out all accounts**.
3. Review the **Audit log**.

**Reporting:** see [SECURITY.md](../SECURITY.md).
