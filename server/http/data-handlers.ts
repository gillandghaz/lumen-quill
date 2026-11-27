import { HttpError } from "../errors";
import { requireUser } from "../session";
import { RULES } from "../security/rate-limit";
import { writeAudit } from "../services/audit";
import { allNotesPortable, deleteAllNotes, importNotes, todayFor } from "../services/notes";
import { confirmSchema, exportQuery, importSchema } from "@/shared/schemas";
import { LIMITS } from "@/shared/limits";
import { fileNameFor, parseNotes, serializeNotes } from "@/shared/markdown-io";
import { download, json } from "./respond";
import { body, query, safe, writer, type Handler } from "./kit";

/** Export the caller's own notes as one .md or .txt file (same readable structure, see shared/markdown-io.ts). */
export const exportH: Handler = safe(async (req, deps) => {
  const u = await requireUser(req, deps);
  await deps.limiter.hit("export", u.identity.uid, RULES.export);
  const { format, noteId } = exportQuery.parse(query(req));
  const list = await allNotesPortable(deps.db, u.identity.uid, noteId);
  const name = noteId && list[0] ? fileNameFor(list[0].title, format) : `lumine-archive-${todayFor(u.profile.settings.timeZone, deps.now())}.${format}`;
  return download(serializeNotes(list), name, format === "md" ? "text/markdown" : "text/plain");
});

/**
 * Import .md / .txt files as NEW notes. Files are read in the browser and sent as text (no binary uploads);
 * the server parses them again with strict limits.
 */
export const importH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps, "import");
  const { files } = importSchema.parse(await body(req, LIMITS.importTotalBytes * 2 + 16_384));
  for (const f of files) if (!/\.(md|markdown|txt)$/i.test(f.name)) throw new HttpError(400, "unsupported_file");
  const today = todayFor(u.profile.settings.timeZone, deps.now());
  const parsed = files.flatMap((f) => parseNotes(f.text, f.name, today));
  if (parsed.length === 0) throw new HttpError(400, "empty_import");
  if (parsed.length > 200) throw new HttpError(400, "too_many_notes");
  const res = await importNotes(deps.db, u.identity.uid, parsed, deps.now());
  await writeAudit(deps.db, { action: "data.import", actorUid: u.identity.uid, details: res }, deps.now());
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
