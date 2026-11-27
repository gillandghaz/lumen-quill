import { z } from "zod";
import { AVATAR_MAX_CHARS, HOME_TABS, LIMITS, MODES, NEXT_DAY } from "./limits";
import { isValidDay, isValidTimeZone } from "./day";
import { byteLength, cleanTitle } from "./text";

const title = z.string().max(LIMITS.titleChars * 4).transform(cleanTitle).pipe(z.string().max(LIMITS.titleChars));
const entryBody = z.string().refine((s) => byteLength(s) <= LIMITS.entryBytes, { message: "too_large" });

export const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const daySchema = z.string().refine(isValidDay, { message: "invalid_day" });
export const timeZoneSchema = z.string().refine(isValidTimeZone, { message: "invalid_tz" });

export const sessionSchema = z.object({ idToken: z.string().min(20).max(4096), timeZone: timeZoneSchema.optional() }).strict();

export const createNoteSchema = z.object({ title: title.optional() }).strict();
export const renameNoteSchema = z.object({ title }).strict();
export const saveEntrySchema = z.object({
  body: entryBody,
  /** updatedAt the editor last saw; a newer stored version means another tab wrote in between (409). */
  baseUpdatedAt: z.number().int().nonnegative().nullable().optional(),
}).strict();
export const listNotesQuery = z.object({ cursor: z.string().max(200).optional(), q: z.string().max(100).optional(), count: z.enum(["1"]).optional() }).strict();
export const timelineQuery = z.object({ cursor: z.string().max(40).optional() }).strict();

export const settingsSchema = z.object({
  mode: z.enum(MODES).optional(),
  timeZone: timeZoneSchema.optional(),
  nextDay: z.enum(NEXT_DAY).optional(),
  fontScale: z.number().min(0.85).max(1.3).optional(),
  homeTab: z.enum(HOME_TABS).optional(),
}).strict();

export const usernameSchema = z.string().min(LIMITS.usernameMin).max(LIMITS.usernameMax).regex(/^[a-z0-9](?:[a-z0-9_.]*[a-z0-9])?$/, "username_invalid");
const usernameInput = z.string().max(64).transform((s) => s.trim().toLowerCase()).pipe(usernameSchema);
export const profileSchema = z.object({ username: usernameInput }).strict();

export const importSchema = z.object({
  files: z.array(z.object({ name: z.string().min(1).max(200), text: z.string() }).strict()).min(1).max(LIMITS.importFiles),
}).strict().refine((v) => v.files.reduce((n, f) => n + byteLength(f.text), 0) <= LIMITS.importTotalBytes, { message: "too_large" });

export const exportQuery = z.object({
  format: z.enum(["md", "txt"]).default("md"),
  noteId: z.string().regex(ID_PATTERN).optional(),
}).strict();

export const confirmSchema = z.object({ confirm: z.string().max(64) }).strict();

// ---- Admin
export const adminCreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  username: usernameInput,
  /** Optional: without a password the account can only sign in with Google. */
  password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax).optional(),
}).strict();
export const adminUpdateUserSchema = z.object({ disabled: z.boolean() }).strict();
export const auditQuery = z.object({ cursor: z.string().max(200).optional() }).strict();

const retention = z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(30)]);
export const retentionSchema = z.object({ statsDays: retention.optional(), auditDays: retention.optional() }).strict();

/** A square JPEG produced in the browser (256 px), as a data URL; re-checked on the server. */
export const avatarSchema = z.object({
  image: z.string().max(AVATAR_MAX_CHARS).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/),
}).strict();

export const backupQuery = z.object({
  cursor: z.string().max(40).optional(),
  from: daySchema.optional(),
  to: daySchema.optional(),
}).strict();

export const passwordCreateSchema = z.object({ password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax) }).strict();
