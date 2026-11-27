/** Hard limits shared by client (early feedback) and server (enforcement). */
export const LIMITS = {
  titleChars: 120,
  /** One day's entry. Firestore documents max out at 1 MiB; stay far below. */
  entryBytes: 200_000,
  entriesPerNote: 1000,
  notesPerUser: 5000,
  importFiles: 20,
  importTotalBytes: 2_000_000,
  usernameMin: 3,
  usernameMax: 24,
  passwordMin: 12,
  passwordMax: 128,
} as const;

export const MODES = ["sonata", "palace"] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (v: unknown): v is Mode => typeof v === "string" && (MODES as readonly string[]).includes(v);
export const MODE_COOKIE = "la_mode";

/** What "Write" does when the latest note was last written on an earlier day. */
export const NEXT_DAY = ["ask", "continue", "new"] as const;
export type NextDayBehavior = (typeof NEXT_DAY)[number];

/** Which Home tab opens first. */
/** Home tabs: Overview, Notes (every dated entry, newest first), Archive (the list of notes). */
export const HOME_TABS = ["overview", "notes", "archive"] as const;
export type HomeTab = (typeof HOME_TABS)[number];
export const isHomeTab = (v: unknown): v is HomeTab => typeof v === "string" && (HOME_TABS as readonly string[]).includes(v);

/** Admin retention choices (days) for statistics and audit data. */
export const RETENTION_DAYS = [1, 3, 7, 30] as const;
export type RetentionDays = (typeof RETENTION_DAYS)[number];

/** Archive rows are one line (title + facts), so a page holds 20. */
export const NOTES_PAGE_SIZE = 20;
export const TIMELINE_PAGE_SIZE = 20;
export const AVATAR_MAX_CHARS = 120_000;
