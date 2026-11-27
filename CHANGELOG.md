# Changelog

## 0.1.0 · 2026-11-27

First release.

- Landing page, sign-in (Google or e-mail + password), password reset. No public sign-up.
- Archive of notes with dated sections: same day continues the latest note; a later day asks to continue or start a new note (configurable).
- Autosaving editor with offline retry, flush on leave and two-tab conflict guard; safe Markdown reading view.
- Two modes: **Sonata** (modern, celestial) and **Palace** (classic, European court).
- Account (username, password, sign out everywhere), Settings (mode, new-day behaviour, time zone, text size), Data (export / import .md and .txt, delete all).
- Admin dashboard: accounts (create, disable, sign out, delete), statistics, security posture and audit log, full JSON backup.
- Security: HttpOnly `__Host-` session cookie, Origin + Fetch-Metadata CSRF checks, strict Zod input, byte limits, rate limits, nonce CSP, Firestore closed to clients, gitleaks / npm audit / OSV in CI, daily retention cron.
