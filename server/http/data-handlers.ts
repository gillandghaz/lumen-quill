import { HttpError } from "../errors";
import { requireUser } from "../session";
import { RULES } from "../security/rate-limit";
import { writeAudit } from "../services/audit";
import { allNotesPortable, deleteAllNotes, importNotes, todayFor } from "../services/notes";
import { confirmSchema, exportQuery, importChunkSchema } from "@/shared/schemas";
import { LIMITS } from "@/shared/limits";
import { fileNameFor, serializeNotes } from "@/shared/markdown-io";
import { download, json } from "./respond";
import { body, query, safe, writer, type Handler } from "./kit";

/** Export the caller's own notes as one .md or .txt file (same readable structure, see shared/markdown-io.ts). */
export const exportH: Handler = safe(async (req, deps) => {
  const u = await requireUser(req, deps);
  await deps.limiter.hit("export", u.identity.uid, RULES.export);
  const { format, noteId } = exportQuery.parse(query(req));
  const list = await allNotesPortable(deps.db, u.identity.uid, noteId);
  const name = noteId && list[0] ? fileNameFor(list[0].title, format) : `lumen-quill-${todayFor(u.profile.settings.timeZone, deps.now())}.${format}`;
  return download(serializeNotes(list), name, format === "md" ? "text/markdown" : "text/plain");
});

/**
 * Import, one chunk at a time: the browser reads and parses the .md / .txt files (any number, whole folders) and
 * sends the notes in chunks of ≤ 50 notes / 1.5 MB. Everything is validated again here; days after the writer's
 * "today" are refused. Duplicates of earlier imports are skipped (see importNotes).
 */
export const importH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps, "import");
  const { notes } = importChunkSchema.parse(await body(req, LIMITS.importChunkBytes + 65_536));
  const today = todayFor(u.profile.settings.timeZone, deps.now());
  for (const n of notes) for (const e of n.entries) if (e.day > today) throw new HttpError(400, "future_day");
  const res = await importNotes(deps.db, u.identity.uid, notes.map((n) => ({ title: n.title || "Imported note", entries: n.entries })), deps.now());
  if (res.notes > 0) await writeAudit(deps.db, { action: "data.import", actorUid: u.identity.uid, details: res }, deps.now());
  return json(200, res);
});

/** Permanently delete ALL of the caller's notes. Requires typing DELETE ALL. */
export const deleteAllH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps, "destructive");
  const { confirm } = confirmSchema.parse(await body(req, 256));
  if (confirm !== "DELETE ALL") throw new HttpError(400, "confirmation_mismatch");
  const removed = await deleteAllNotes(deps.db, u.identity.uid);
  await writeAudit(deps.db, { action: "data.delete_all", actorUid: u.identity.uid, details: { notes: removed } }, deps.now());
  return json(200, { notes: removed });
});
