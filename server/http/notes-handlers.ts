import { z } from "zod";
import { requireUser } from "../session";
import { RULES } from "../security/rate-limit";
import { HttpError } from "../errors";
import { writeAudit } from "../services/audit";
import {
  createNote, deleteEntry, deleteNoteIfEmpty, overview, timeline, deleteNote, getNote, listNotes, renameNote, saveEntry, todayFor, writeTarget,
} from "../services/notes";
import { createNoteSchema, daySchema, listNotesQuery, renameNoteSchema, saveEntrySchema, timelineQuery } from "@/shared/schemas";
import { LIMITS } from "@/shared/limits";
import { json } from "./respond";
import { body, query, safe, validId, writer, type Handler } from "./kit";

/** Every note handler works on the caller's own notes only: the owner always comes from the session. */
export const listNotesH: Handler = safe(async (req, deps) => {
  const u = await requireUser(req, deps);
  const q = listNotesQuery.parse(query(req));
  if (q.q) await deps.limiter.hit("search", u.identity.uid, RULES.search);
  // Deep pages read every skipped row (offset), so only they count against the heavy-read budget.
  else if (q.page && Number(q.page) > 5) await deps.limiter.hit("heavy-read", u.identity.uid, RULES.heavyRead);
  return json(200, await listNotes(deps.db, u.identity.uid, { page: q.page ? Number(q.page) : undefined, q: q.q }));
});

export const writeTargetH: Handler = safe(async (req, deps) => {
  const u = await requireUser(req, deps);
  const t = await writeTarget(deps.db, u.identity.uid, u.profile.settings.timeZone, deps.now());
  return json(200, { ...t, nextDay: u.profile.settings.nextDay });
});

export const createNoteH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps);
  const { title } = createNoteSchema.parse(await body(req, 2048));
  return json(201, await createNote(deps.db, u.identity.uid, title, deps.now()));
});

export const getNoteH: Handler = safe(async (req, deps, p) => {
  const u = await requireUser(req, deps);
  const data = await getNote(deps.db, u.identity.uid, validId(p["id"]));
  return json(200, { ...data, today: todayFor(u.profile.settings.timeZone, deps.now()) });
});

export const renameNoteH: Handler = safe(async (req, deps, p) => {
  const u = await writer(req, deps);
  const { title } = renameNoteSchema.parse(await body(req, 2048));
  await renameNote(deps.db, u.identity.uid, validId(p["id"]), title, deps.now());
  return json(200, { ok: true });
});

const deleteQuery = z.object({ ifEmpty: z.enum(["1"]).optional() }).strict();

export const deleteNoteH: Handler = safe(async (req, deps, p) => {
  const u = await writer(req, deps);
  const id = validId(p["id"]);
  // Leaving a note that was never written in: remove it only if it is still empty.
  if (deleteQuery.parse(query(req)).ifEmpty) return json(200, { deleted: await deleteNoteIfEmpty(deps.db, u.identity.uid, id) });
  await deleteNote(deps.db, u.identity.uid, id);
  await writeAudit(deps.db, { action: "note.delete", actorUid: u.identity.uid }, deps.now());
  return json(200, { ok: true });
});

const parseDay = (d: string | undefined): string => {
  const r = daySchema.safeParse(d);
  if (!r.success) throw new HttpError(404, "not_found");
  return r.data;
};

export const saveEntryH: Handler = safe(async (req, deps, p) => {
  const u = await writer(req, deps, "save");
  const { body: text, baseUpdatedAt } = saveEntrySchema.parse(await body(req, LIMITS.entryBytes * 2 + 1024));
  const today = todayFor(u.profile.settings.timeZone, deps.now());
  return json(200, await saveEntry(deps.db, u.identity.uid, validId(p["id"]), parseDay(p["day"]), text, today, deps.now(), baseUpdatedAt));
});

export const deleteEntryH: Handler = safe(async (req, deps, p) => {
  const u = await writer(req, deps);
  return json(200, { note: await deleteEntry(deps.db, u.identity.uid, validId(p["id"]), parseDay(p["day"]), deps.now()) });
});

/** Home → Overview: personal totals, streak and the five most recent notes. */
export const overviewH: Handler = safe(async (req, deps) => {
  const u = await requireUser(req, deps);
  return json(200, await overview(deps.db, u.identity.uid, todayFor(u.profile.settings.timeZone, deps.now()), u.profile.writing));
});

/** Home → Notes: every dated entry across all notes, newest day first. */
export const timelineH: Handler = safe(async (req, deps) => {
  const u = await requireUser(req, deps);
  return json(200, await timeline(deps.db, u.identity.uid, timelineQuery.parse(query(req)).cursor));
});
