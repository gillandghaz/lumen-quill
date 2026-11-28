# Pages

Map of every page, tab and menu.

| Path | Who | Contents |
|---|---|---|
| `/` | Signed out (signed in → `/home`) | Landing page: introduction, the two modes (click to preview), **Sign in** |
| `/login` | Signed out (signed in → `/home`) | Google or e-mail + password, **Forgot password?** |
| `/forgot-password` | Anyone | Request a reset link |
| `/home` | Signed in | Tabs **Overview**, **Notes**, **Archive**; buttons **New note**, **Write today** |
| `/home?tab=overview\|notes\|archive` | Signed in | Opens that tab (without `tab`: the *Open on* preference) |
| `/notes/{id}` | The note's owner | Dated sections, today's box, export, delete |
| `/notes/{id}?continue=1` | The note's owner | Same, with a section for today opened (chosen "Continue") |
| `/settings` | Signed in | Sections **Account**, **Preferences**, **Data**, **Admin** (admin only) |
| `/settings?tab=account\|preferences\|data\|admin` | Signed in | Opens that section |
| any other | Anyone | "Not in the archive" (404) |

Old addresses redirect: `/archive` → `/home?tab=archive`, `/account` → `/settings?tab=account`, `/data` → `/settings?tab=data`, `/admin` → `/settings?tab=admin`.

## Top bar (signed in)

Fixed at the top of every app page.

- **Lumen Quill** (left): back to Home on the *Open on* tab.
- **Profile photo** (right): **Home**, **Settings**, **Sign out** (asks for confirmation).

## Settings → Admin

| Tab | Contents |
|---|---|
| Accounts | List (photo, sign-in, notes, last sign-in, status; 10 per page), Disable / Enable, Sign out, Delete, Create account |
| Statistics | Totals, daily activity chart and table, *auto-delete statistics after* 1/3/7/30 days |
| Security | Live security checks, **Sign out all accounts** |
| Audit log | Sign-ins and admin actions, *auto-delete audit entries after* 1/3/7/30 days |
| Backup | JSON backup: everything or a date range |
