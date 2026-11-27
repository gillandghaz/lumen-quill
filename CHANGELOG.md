# Changelog

## 0.2.2 · 2026-11-28

- Imported notes take their "created" date from their earliest dated section (when they were first written), so the Archive keeps them in true writing order instead of grouping them at the import time.

## 0.2.1 · 2026-11-28

- **Writing flow.**
  - Same day: "Write today" only continues the note. It opens on today's section with one new line and the cursor after the last character.
  - A later day: continue (a new section for today below the earlier days) or start a new note.
  - **Earlier days are locked.** The server refuses edits (`day_locked`). Locked days are shown read-only, sized to their text, and can still be deleted.
  - An older note opened from the Archive is read-only, with a "Continue this note today" button.
  - Today's box grows with its text.
- **Archive.** Notes are ordered by when they were created, newest first, and editing no longer reshuffles them. Rows show the title and facts only (no content), 20 per page.
- **Home.** Clicking Home (menu or brand) always returns to the "Open on" tab.
- **Fixes.**
  - Autosave no longer shifts the page (fixed-size status badge).
  - Month labels in Notes no longer cover the timeline rail.
  - Spacing under the backup range switch and under the username hint.

## 0.2.0 · 2026-11-28

- **New layout.** Fixed top bar with the brand and a profile photo menu (Home, Settings, Sign out with confirmation).
  - **Home** has Overview (today, totals, streak, recent notes), Notes (every dated entry, newest first) and Archive (the list of notes, 15 per page with "page x of y"). The first tab is a preference.
  - **Settings** has Account, Preferences, Data and Admin.
- **Sign-in routing.** Signed-in visitors of `/` and `/login` go straight to Home. Signed-out visitors of app pages go to sign-in. Old addresses (`/archive`, `/account`, `/data`, `/admin`) redirect.
- **Account.**
  - Custom profile photo (256 px JPEG, checked on the server) or a themed default emblem.
  - Usernames are unique.
  - Passwords are changed only through an e-mailed reset link. Google-only accounts can create a password.
- **Preferences** fit in one compact panel with segmented controls.
- **Data.** "Delete all" now needs the typed phrase and a final confirmation dialog.
- **Admin.**
  - Accounts show photos, scroll after 5 rows and paginate per 10.
  - Disable, enable, sign out and delete each ask for confirmation in a dialog.
  - The create-account form is aligned.
  - Statistics, Security and Audit log are separate tabs. Long lists scroll.
  - Statistics now reads tiny daily counters instead of scanning notes.
  - Statistics and the audit log each have an auto-delete setting (1, 3, 7 or 30 days).
  - Backups can be limited to a date range.
- **Autosave status.** The note shows Saving… → All changes saved. The browser's own dialog warns before leaving while a save is pending.
- **Motion.** Smooth page, tab and dialog transitions, a cross-fade when switching modes, and hover feedback on buttons, cards and menus. Motion is reduced when the system asks for it.
- **Fixes.**
  - The Sonata "Sign in" button text was light on gold; it is now dark.
  - The Palace ruled lines now sit exactly under each line of text.
  - Overview failed on a combined sum query.
  - Firestore settings could be applied twice across bundles.
- **Workflow.** Changes reach `main` only through pull requests (CONTRIBUTING.md, pre-push hook, `pr-only` CI job). The favicon is a round seal.

## 0.1.0 · 2026-11-27

First release.

- Landing page, sign-in (Google or e-mail + password), password reset. No public sign-up.
- Archive of notes with dated sections: same day continues the latest note; a later day asks to continue or start a new note (configurable).
- Autosaving editor with offline retry, flush on leave and two-tab conflict guard; safe Markdown reading view.
- Two modes: **Sonata** (modern, celestial) and **Palace** (classic, European court).
- Account (username, password, sign out everywhere), Settings (mode, new-day behaviour, time zone, text size), Data (export / import .md and .txt, delete all).
- Admin dashboard: accounts (create, disable, sign out, delete), statistics, security posture and audit log, full JSON backup.
- Security: HttpOnly `__Host-` session cookie, Origin + Fetch-Metadata CSRF checks, strict Zod input, byte limits, rate limits, nonce CSP, Firestore closed to clients, gitleaks / npm audit / OSV in CI, daily retention cron.
