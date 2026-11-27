# Security policy

Supported version: **the latest release on `main`** (see [CHANGELOG.md](CHANGELOG.md)).

## Reporting a vulnerability

Please **do not** open a public issue, pull request or discussion with vulnerability details.

1. Use GitHub's **private vulnerability reporting** (Security → *Report a vulnerability*) on this repository.
2. Include a summary, the affected endpoint or file, minimal reproduction steps and the impact you expect.
3. Never access, change or delete other people's data while testing, and do not test against production data.

The owner aims to acknowledge reports within **7 days**, and fixes are prioritised by severity.

## If a secret leaks

Revoke or rotate it at the provider **first**, then clean the history. Removing the file from the repository is not enough. Steps per secret: [docs/Security.md → Incident procedures](docs/Security.md#8-incident-procedures).

## Controls in short

| Area | Control |
|---|---|
| Authentication | HttpOnly `__Host-` session cookie; signature verified on every request; revocation and *disabled* re-checked at least every 60 s; no sign-up |
| Authorisation | Owner from the session; other users' data answers 404; single administrator (claim + profile) |
| CSRF | `Origin` must equal `APP_ORIGIN`; Fetch-Metadata checked |
| Input | Strict Zod schemas, byte limits, JSON only |
| Abuse and quota | Rate limits, heavy-read limits, caches, throttled autosave, bounded retries |
| Data | Firestore rules deny every client; all access through the server |
| Headers | Nonce CSP, HSTS preload, `frame-ancestors 'none'`, nosniff, COOP, CORP |
| Secrets | Outside the repo; gitleaks in CI (full history) and pre-commit |
| Dependencies | Exact pins, `npm audit` (any severity), OSV-Scanner, Dependabot |
| Code | CodeQL code scanning (extended queries) |

Threat model, provider settings and the latest audit: [docs/Security.md](docs/Security.md).
