# Security

> Applies to: **lumen-archive** (private repository). Supported version: **the latest release on `main` only**.

## Reporting a vulnerability

Do **not** open public issues, pull requests or discussions with vulnerability details. Contact the repository owner privately through GitHub with a summary, the affected endpoint/file, minimal reproduction steps and the expected impact. Never access, change or delete other people's data while testing.

## Trust boundary

```
Browser (untrusted)
   │  HttpOnly session cookie · Origin header · JSON
   ▼
Vercel server (trusted)       ── the only holder of secrets
   ├─► Firebase Auth : who is this? (session cookie verified, role from custom claim + profile)
   └─► Firestore     : all data (Admin SDK). Security rules deny ALL client access.
```

The browser never talks to Firestore. The Firebase web API key is public by design and only used to obtain an ID token at sign-in.

## Controls

| Area | Control | Code |
|---|---|---|
| Sign-up | None in the app; Firebase self sign-up blocked (`disabledUserSignup`); a session requires an admin-created profile; a self-created Firebase account without a profile is deleted on the spot | `server/http/auth-handlers.ts`, `server/services/admin.ts` |
| Sessions | Cookie `__Host-la_session`: HttpOnly, Secure, SameSite=Lax, 24 h. Signature checked on every request; revocation and "disabled" re-checked with Firebase at least every 60 s. ID token must come from a sign-in ≤ 5 min old. The browser SDK is signed out right after the exchange (session-only persistence) | `server/auth.ts`, `server/http/cookies.ts`, `client/auth/*` |
| Admin | Exactly one admin. Role requires the verified custom claim **and** the profile role; a mismatch refuses sign-in. Admin cannot disable/delete itself or another admin. Created accounts are always `user` | `server/session.ts`, `scripts/bootstrap-admin.mjs` |
| Account takeover | E-mail cannot be changed in the app; a different Firebase e-mail refuses sign-in and is audited. Setting a password needs a sign-in ≤ 10 min old and revokes all sessions | `server/http/auth-handlers.ts`, `server/http/account-handlers.ts` |
| Authorisation (IDOR) | Owner always from the session; another user's note answers 404 (ids never leak). Server decides "today" from the user's time zone; past days can only be edited if they exist | `server/services/notes.ts` |
| CSRF | Mutations require `Origin` = `APP_ORIGIN` and, when present, `Sec-Fetch-Site: same-origin` | `server/security/csrf.ts` |
| Input | Strict Zod schemas (no unknown keys), JSON content type required, body limits in **bytes** checked before reading, entry ≤ 200 KB | `shared/schemas.ts`, `server/http/respond.ts` |
| Abuse | Fixed-window rate limits per user / IP in Firestore (hashed keys); destructive actions need typed confirmation | `server/security/rate-limit.ts` |
| XSS | No raw HTML anywhere (lint rule bans `dangerouslySetInnerHTML`); Markdown rendered to React elements; strict **nonce-based CSP** with `strict-dynamic`, no `unsafe-inline`/`unsafe-eval` scripts | `proxy.ts`, `client/components/Markdown.tsx` |
| Headers | HSTS (preload), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, nosniff, COOP, CORP, Referrer-Policy, Permissions-Policy; API: `default-src 'none'`, `no-store`; downloads are `attachment` + sandboxed | `next.config.ts`, `server/http/respond.ts` |
| Import / export | Text only (.md / .txt), parsed in the browser and again on the server with limits; control characters stripped; file names ASCII-sanitised | `shared/markdown-io.ts`, `server/http/data-handlers.ts` |
| Logs & audit | Logs carry error names/codes only; the audit log stores ids, codes and counts (never note text or e-mail), kept 180 days | `server/services/audit.ts` |
| Retention | Daily Vercel Cron (constant-time bearer secret, fails closed) removes expired rate-limit counters and old audit entries | `server/services/retention.ts` |
| Secrets | Only in Vercel env and a local file outside the repo; `.gitignore`; gitleaks over the full history in CI and an optional pre-commit hook | `.gitleaks.toml`, `.github/workflows/ci.yml` |
| Dependencies | Exact versions, `npm audit --audit-level=low` (zero vulnerabilities) and OSV-Scanner in CI, Dependabot weekly | `package.json`, `.github/*` |

## Firebase Auth project settings (expected)

Self sign-up **blocked**, self account deletion **blocked**, e-mail enumeration protection **on**, password policy **enforced, min 12**, anonymous and phone sign-in **off**, authorised domains: `localhost`, the Firebase domains and the Vercel production domain. The admin dashboard (**Admin → Security**) reads these live.

## Known gaps

- No MFA or App Check (MFA needs Identity Platform, a paid upgrade).
- Firestore TTL policies need billing; the daily cron does the clean-up instead.
- Firestore backups are manual (Admin → Backup).

## If a secret leaks

**Assume it was abused.** Revoke/rotate at the provider first, then clean history.

| Secret | How to rotate |
|---|---|
| `FIREBASE_PRIVATE_KEY` | Google Cloud IAM → service account → create a new key → update Vercel → redeploy → delete the old key |
| `RATE_LIMIT_SECRET`, `CRON_SECRET` | New random value → update Vercel → redeploy |

If an account is compromised: Admin → Accounts → **Disable** (refused within 60 s), or Admin → Security → **Sign out all accounts**; review the audit log.
