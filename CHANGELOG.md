# Changelog

## 1.0.1 · 2026-11-28

Fixes:
- **Settings show the latest values.** After switching e.g. Sonata → Palace and coming back from another menu, Preferences, Home, the profile menu and **Write today** now show the new choice. Before, they could briefly show the old one, because of the short page and profile caches.
- **Pages in Notes and Archive.** Notes now has numbered pages with a total, like Archive. Click **Page x of y** to type a page and press Enter to go there. A page past the end shows an empty list with the last page.
- **Dialogs** have a solid background, so the page behind no longer shows through.
- **Spacing:** status messages ("Reset link sent…", "Photo updated." and others) sit a little below their buttons and leave no empty space underneath.

## 1.0.0 · 2026-11-28

First stable release.

**Security audit** (details in [docs/Security.md](docs/Security.md#4-audit-for-100)):
- Sign-in verifies the Firebase token before any database write, so junk tokens cannot spend the quota.
- Heavy reads are rate-limited: search (20 / 10 min, scans 300 notes), deep archive pages and statistics (30 / 10 min), export (10 / hour).
- The admin account list handles more than 100 accounts.
- The CSP no longer allows an unused image host.
- The Firebase browser API key is restricted to the app's domains and the two Auth APIs.
- Dependabot alerts and security updates are on.
- GitHub Actions have a read-only token and only allowed actions may run. Rulesets for `main`, `release/*` and `v*` tags are kept in `.github/rulesets/`.

**Quota (Firestore reads and writes):**
- Autosave saves after a 2.5 s pause and at most every 10 s, and its rate limiter lives in memory.
- The writing streak is stored on the profile, so Overview costs about 8 reads instead of about 68.
- The session check runs every 5 min instead of every 60 s.
- Failed saves back off up to 2 min and stop after 8 tries.
- Note links no longer prefetch.
- Caching: a 60 s browser cache of reads, emptied by any change; a 30 s router cache; a 15 s server-side profile cache.

**Single click:** busy buttons lock, identical requests in flight are shared, and export locks for a few seconds.

**Documentation:** a new README and an illustrated user guide (sample data only), plus Pages, Architecture, Database, API, Operations, Security (threat model and audit), Troubleshooting, Dependencies, Glossary and Agent.md. A test keeps versions, links, screenshots and the endpoint list consistent.

**Repository:**
- Published with all rights reserved.
- The owner's username and e-mail are removed from files, screenshots and commit authorship.
- The `pr-only` CI check no longer raises a false alarm right after a merge.

**UI:**
- Admin table headers and dates stay on one line.
- Live italic is clearly slanted while typing. Each word is skewed, and its width is unchanged so the caret stays put; before, the font-based slant was not drawn.
- Locked days use the real italic faces.
- The phone screenshot is centred in its block.

**Licence:**
- full bilingual (Indonesian / English) all-rights-reserved terms based on Law No. 28/2014;
- explicit prohibitions, including the name, logo and designs;
- the GitHub fork clause, no outside contributions, and the third-party licences (npm packages, SIL OFL fonts).

**README badges** are stored in `docs/badges/` and served by GitHub directly. Before, GitHub's image proxy (camo) loaded them from shields.io and sometimes timed out (HTTP 504, shown as a broken image).

## 0.3.1 · 2026-11-28

- **Live formatting while typing.** `**bold**` and `*italic*` appear bold and italic as you type. The markers stay in place but are smaller and faint, and the caret never shifts (bold is a thicker stroke and italic a slant, so glyph widths stay the same).
- **Empty notes disappear.** Leaving a note that has nothing written removes it. Clearing today's text removes today's section. A daily clean-up also removes notes still empty after 24 hours.
- **Export.**
  - Notes are ordered by creation date, newest first, like the Archive.
  - File names carry a date: a single note uses the day it was created (`2026-11-14-morning-pages.md`), and everything uses the export day (`lumen-quill-export-2026-11-28.md`).
- **Dialogs** never show scrollbars; long words wrap.

## 0.3.0 · 2026-11-28

- **Much larger imports.**
  - Any number of .md / .txt files, up to 1,000 files or 50 MB at once, or a whole folder (**Choose folder**).
  - Files are parsed in the browser and previewed (files · notes · days · size), then sent in chunks of up to 50 notes with a progress bar.
  - The server re-validates every chunk: dates must be real days and not after today; size and quota limits apply.
- **No duplicates.** A note whose exact content was imported before is skipped. If an import stops (for example at the daily Firestore write limit), run it again: it continues without doubling anything.
- **Dialogs are always centred on the screen.** "Write today" on the Notes and Archive tabs could open its dialog off-screen on a long page. All dialogs now render at the top level, and the page behind them does not scroll.
- **Formatted text.** `*italic*` and `**bold**` show as italic and bold, with the markers hidden. This applies to locked days, and to today's box whenever you are not typing (click it to continue, with the cursor at the end). Previews in Notes and Overview no longer show the markers.

## 0.2.2 · 2026-11-28

- Imported notes take their "created" date from their earliest dated section (when they were first written), so the Archive keeps them in true writing order instead of grouping them at the import time.
- **Write today** now continues the note you last *wrote in* (latest dated section). Before, it used the last database update, so after an import it could pick an arbitrary note. A note just created with New note and still empty is opened directly.
- **Archive pages are numbered.** Type any page number to jump to it. A page past the end is shown empty, with a message naming the last page.
- The Save (username) and Delete all notes buttons are exactly as tall as the input beside them.

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
