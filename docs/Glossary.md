# Glossary

| Term | Meaning |
|---|---|
| **Note** | A titled stack of dated sections |
| **Entry / section / day** | The text of one calendar day inside a note (`YYYY-MM-DD`, in the writer's time zone) |
| **Today** | The current day in the writer's time zone, decided by the server; the only writable day |
| **Locked day** | Any earlier day: read-only, deletable |
| **Write today** | Continue the note last written in (same day), or choose continue / new (new day) |
| **Continue** | Add a section for today to an existing note |
| **Archive** | Home tab listing notes in creation order |
| **Notes (tab)** | Home tab listing every dated entry, newest first |
| **Overview** | Home tab with today, totals, streak and recent notes |
| **Streak** | Consecutive days with writing, ending today or yesterday |
| **Sonata / Palace** | The two display modes: modern celestial / classic European court |
| **Open on** | Preference: which Home tab opens first |
| **A new day** | Preference: ask, always continue, or always start a new note |
| **Interchange format** | The `.md` / `.txt` layout: `# Title`, `## YYYY-MM-DD`, notes separated by `<!-- lumen:note -->` |
| **Import fingerprint** | SHA-256 of a note's title and sections; an identical note is not imported twice |
| **Retention** | How long statistics and audit data are kept (1/3/7/30 days) |
| **Session cookie** | `__Host-la_session`, HttpOnly, issued by the server after sign-in |
| **Heavy read** | A request that reads many documents (search, deep page, statistics); tightly rate-limited |
| **Spark** | Firebase's free plan (no billing account; daily quotas) |
| **Fail closed** | When configuration is missing, refuse to serve rather than run unprotected |
