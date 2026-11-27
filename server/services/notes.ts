import { createHash, randomBytes } from "node:crypto";
import { AggregateField, type Firestore } from "../firebase";
import { COLLECTIONS } from "../config";
import { HttpError } from "../errors";
import { LIMITS, NOTES_PAGE_SIZE, TIMELINE_PAGE_SIZE } from "@/shared/limits";
import { recordActivity } from "./activity";
import { forgetProfile } from "./profile";
import { byteLength, preview, wordCount } from "@/shared/text";
import { dayKey } from "@/shared/day";
import type { PortableNote } from "@/shared/markdown-io";

export const newId = (): string => randomBytes(16).toString("base64url");

export interface NoteMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  firstDay: string | null;
  lastDay: string | null;
  entryCount: number;
  words: number;
  preview: string;
}

export interface Entry {
  day: string;
  body: string;
  words: number;
  createdAt: number;
  updatedAt: number;
}

interface NoteDoc extends Omit<NoteMeta, "id"> {
  ownerUid: string;
  bytes: number;
}

const notes = (db: Firestore) => db.collection(COLLECTIONS.notes);
const entries = (db: Firestore, noteId: string) => notes(db).doc(noteId).collection(COLLECTIONS.entries);

function toMeta(id: string, d: NoteDoc): NoteMeta {
  return {
    id,
    title: d.title,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    firstDay: d.firstDay ?? null,
    lastDay: d.lastDay ?? null,
    entryCount: d.entryCount ?? 0,
    words: d.words ?? 0,
    preview: d.preview ?? "",
  };
}

/** Loads a note the user OWNS. Anything else (missing or someone else's) is the same 404: ids never leak. */
async function ownedNote(db: Firestore, uid: string, noteId: string): Promise<NoteDoc> {
  const snap = await notes(db).doc(noteId).get();
  const d = snap.data() as NoteDoc | undefined;
  if (!snap.exists || !d || d.ownerUid !== uid) throw new HttpError(404, "not_found");
  return d;
}

export function todayFor(timeZone: string, now: number): string {
  return dayKey(now, timeZone);
}

const PAGE = NOTES_PAGE_SIZE;

/**
 * Archive: notes in creation order (newest first), NOTES_PAGE_SIZE per numbered page. Any page number may be asked
 * for; a page past the end comes back empty together with the real number of pages. Firestore bills skipped rows
 * of an offset as reads, so pages are capped (5000 notes / 20 = 250 pages at most).
 */
export async function listNotes(db: Firestore, uid: string, opts: { page?: number; q?: string }): Promise<{ items: NoteMeta[]; page: number; pages: number; total: number }> {
  const mine = notes(db).where("ownerUid", "==", uid);
  if (opts.q && opts.q.trim()) {
    // Title / preview search over the user's notes (bounded scan; caller rate-limits it).
    const needle = opts.q.trim().toLowerCase();
    const snap = await mine.orderBy("createdAt", "desc").limit(300).get();
    const items = snap.docs.map((d) => toMeta(d.id, d.data() as NoteDoc)).filter((n) => n.title.toLowerCase().includes(needle) || n.preview.toLowerCase().includes(needle)).slice(0, 100);
    return { items, page: 1, pages: 1, total: items.length };
  }
  const total = (await mine.count().get()).data().count;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(Math.max(1, opts.page ?? 1), 100_000);
  if (page > pages || page > Math.ceil(LIMITS.notesPerUser / PAGE)) return { items: [], page, pages, total };
  const snap = await mine.orderBy("createdAt", "desc").orderBy("__name__", "desc").offset((page - 1) * PAGE).limit(PAGE).get();
  return { items: snap.docs.map((d) => toMeta(d.id, d.data() as NoteDoc)), page, pages, total };
}

/** The note "Write" should open, and today's date for this user. */
/**
 * The note "Write today" continues: the one you last WROTE in (latest dated section; ties → newest created).
 * Exception: a note you created today with "New note" and left empty is opened instead, as if written today.
 * (Ordering by last write time would pick an arbitrary note after an import, when all share one timestamp.)
 */
export async function writeTarget(db: Firestore, uid: string, timeZone: string, now: number) {
  const today = todayFor(timeZone, now);
  const mine = notes(db).where("ownerUid", "==", uid);
  const [byDay, byCreated] = await Promise.all([
    mine.orderBy("lastDay", "desc").orderBy("createdAt", "desc").limit(1).get(),
    mine.orderBy("createdAt", "desc").limit(1).get(),
  ]);
  const newest = byCreated.docs[0] ? toMeta(byCreated.docs[0].id, byCreated.docs[0].data() as NoteDoc) : null;
  if (newest && newest.lastDay === null && todayFor(timeZone, newest.createdAt) === today) {
    return { today, latest: newest, writtenToday: true };
  }
  const d = byDay.docs[0];
  const written = d ? toMeta(d.id, d.data() as NoteDoc) : null;
  const latest = written && written.lastDay !== null ? written : newest;
  return { today, latest, writtenToday: latest !== null && (latest.lastDay === today || latest.entryCount === 0) };
}

async function assertNoteQuota(db: Firestore, uid: string, adding = 1): Promise<void> {
  const c = await notes(db).where("ownerUid", "==", uid).count().get();
  if (c.data().count + adding > LIMITS.notesPerUser) throw new HttpError(409, "note_limit");
}

export async function createNote(db: Firestore, uid: string, title: string | undefined, now: number): Promise<NoteMeta> {
  await assertNoteQuota(db, uid);
  const id = newId();
  const doc: NoteDoc = {
    ownerUid: uid,
    title: title || "Untitled note",
    createdAt: now,
    updatedAt: now,
    firstDay: null,
    lastDay: null,
    entryCount: 0,
    words: 0,
    bytes: 0,
    preview: "",
  };
  await notes(db).doc(id).create(doc);
  await recordActivity(db, dayKey(now, "UTC"), { notes: 1 });
  return toMeta(id, doc);
}

export async function getNote(db: Firestore, uid: string, noteId: string): Promise<{ note: NoteMeta; entries: Entry[] }> {
  const d = await ownedNote(db, uid, noteId);
  const snap = await entries(db, noteId).orderBy("day", "asc").limit(LIMITS.entriesPerNote).get();
  return {
    note: toMeta(noteId, d),
    entries: snap.docs.map((e) => {
      const x = e.data();
      return { day: x["day"], body: x["body"], words: x["words"] ?? 0, createdAt: x["createdAt"], updatedAt: x["updatedAt"] } as Entry;
    }),
  };
}

export async function renameNote(db: Firestore, uid: string, noteId: string, title: string, now: number): Promise<void> {
  await ownedNote(db, uid, noteId);
  await notes(db).doc(noteId).update({ title: title || "Untitled note", updatedAt: now });
}

/**
 * Save one day's text. Rules:
 * - Writing is only allowed into TODAY (creating it on first save). Earlier days are locked: they can be read or
 *   deleted, never edited (to change one, export, edit elsewhere and import as a new note).
 *   The server decides what "today" is from the user's time zone; the client cannot invent or reopen dates.
 * - `baseUpdatedAt` guards against two tabs overwriting each other: a newer stored version answers 409.
 * - Note aggregates (word count, preview, first/last day) are updated in the same transaction.
 */
export async function saveEntry(
  db: Firestore,
  uid: string,
  noteId: string,
  day: string,
  body: string,
  today: string,
  now: number,
  baseUpdatedAt?: number | null,
): Promise<{ entry: Entry | null; note: NoteMeta }> {
  const noteRef = notes(db).doc(noteId);
  const entryRef = entries(db, noteId).doc(day);
  let delta: { words: number; created: boolean } | null = null;
  let emptied = false;
  const result = await db.runTransaction(async (tx) => {
    delta = null;
    emptied = false;
    const [ns, es] = await Promise.all([tx.get(noteRef), tx.get(entryRef)]);
    const n = ns.data() as NoteDoc | undefined;
    if (!ns.exists || !n || n.ownerUid !== uid) throw new HttpError(404, "not_found");
    const prev = es.exists ? (es.data() as Entry & { bytes?: number }) : null;
    if (day !== today) throw new HttpError(prev ? 403 : 404, prev ? "day_locked" : "not_found");
    if (prev && typeof baseUpdatedAt === "number" && prev.updatedAt > baseUpdatedAt) {
      throw new HttpError(409, "conflict", { public: { updatedAt: prev.updatedAt } });
    }
    if (!prev && body.trim() === "") return { entry: null, note: toMeta(noteId, n) }; // nothing to create yet
    if (prev && body.trim() === "") {
      emptied = true; // today's text was cleared: the section goes away (done below, it needs a query)
      return { entry: null, note: toMeta(noteId, n) };
    }
    if (!prev && (n.entryCount ?? 0) >= LIMITS.entriesPerNote) throw new HttpError(409, "entry_limit");
    // First words of a new day: extend or restart the writing streak (one extra read + write, once per day).
    if (!prev) {
      const userRef = db.collection(COLLECTIONS.users).doc(uid);
      const w = ((await tx.get(userRef)).get("writing") ?? {}) as { lastDay?: string; streak?: number };
      if (w.lastDay !== day) {
        const yesterday = new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
        tx.set(userRef, { writing: { lastDay: day, streak: w.lastDay === yesterday ? (w.streak ?? 0) + 1 : 1 } }, { merge: true });
      }
    }

    const words = wordCount(body);
    const bytes = byteLength(body);
    delta = { words: words - (prev?.words ?? 0), created: !prev };
    const entry: Entry = { day, body, words, createdAt: prev?.createdAt ?? now, updatedAt: now };
    tx.set(entryRef, { ...entry, bytes, ownerUid: uid, noteId });

    const lastDay = !n.lastDay || day >= n.lastDay ? day : n.lastDay;
    const next: NoteDoc = {
      ...n,
      updatedAt: now,
      entryCount: (n.entryCount ?? 0) + (prev ? 0 : 1),
      words: Math.max(0, (n.words ?? 0) - (prev?.words ?? 0) + words),
      bytes: Math.max(0, (n.bytes ?? 0) - (prev?.bytes ?? 0) + bytes),
      firstDay: !n.firstDay || day < n.firstDay ? day : n.firstDay,
      lastDay,
      preview: day === lastDay ? preview(body) : n.preview,
    };
    tx.set(noteRef, next);
    return { entry, note: toMeta(noteId, next) };
  });
  if (emptied) return { entry: null, note: await deleteEntry(db, uid, noteId, day, now) };
  if ((delta as { created: boolean } | null)?.created) forgetProfile(uid); // streak changed
  const d = delta as { words: number; created: boolean } | null;
  if (d) await recordActivity(db, day, { saves: 1, newEntries: d.created ? 1 : 0, words: d.words });
  return result;
}

export async function deleteEntry(db: Firestore, uid: string, noteId: string, day: string, now: number): Promise<NoteMeta> {
  const noteRef = notes(db).doc(noteId);
  const entryRef = entries(db, noteId).doc(day);
  const meta = await db.runTransaction(async (tx) => {
    const [ns, es] = await Promise.all([tx.get(noteRef), tx.get(entryRef)]);
    const n = ns.data() as NoteDoc | undefined;
    if (!ns.exists || !n || n.ownerUid !== uid || !es.exists) throw new HttpError(404, "not_found");
    const prev = es.data() as Entry & { bytes?: number };
    tx.delete(entryRef);
    const next: NoteDoc = {
      ...n,
      updatedAt: now,
      entryCount: Math.max(0, (n.entryCount ?? 1) - 1),
      words: Math.max(0, (n.words ?? 0) - (prev.words ?? 0)),
      bytes: Math.max(0, (n.bytes ?? 0) - (prev.bytes ?? 0)),
    };
    tx.set(noteRef, next);
    return next;
  });
  // First/last day and preview are recomputed outside the transaction (needs a query).
  const rest = await entries(db, noteId).orderBy("day", "asc").get();
  const days = rest.docs.map((d) => d.data() as Entry);
  const last = days[days.length - 1];
  const patch = { firstDay: days[0]?.day ?? null, lastDay: last?.day ?? null, preview: last ? preview(last.body) : "" };
  await noteRef.update(patch);
  return toMeta(noteId, { ...meta, ...patch });
}

/**
 * Delete a note only if nothing was ever written in it (no dated section). Used when leaving a note that stayed
 * empty; checked inside a transaction so a note that just received text is never removed.
 */
export async function deleteNoteIfEmpty(db: Firestore, uid: string, noteId: string): Promise<boolean> {
  const ref = notes(db).doc(noteId);
  return db.runTransaction(async (tx) => {
    const [snap, any] = await Promise.all([tx.get(ref), tx.get(ref.collection(COLLECTIONS.entries).limit(1))]);
    const n = snap.data() as NoteDoc | undefined;
    if (!snap.exists || !n || n.ownerUid !== uid) throw new HttpError(404, "not_found");
    if ((n.entryCount ?? 0) > 0 || !any.empty) return false;
    tx.delete(ref);
    return true;
  });
}

/** Safety net (daily cron): notes still without any writing a day after creation (e.g. the tab was killed). */
export async function purgeEmptyNotes(db: Firestore, now: number): Promise<number> {
  const snap = await db.collection(COLLECTIONS.notes).where("entryCount", "==", 0).where("createdAt", "<", now - 24 * 60 * 60 * 1000).limit(200).get();
  let removed = 0;
  for (const d of snap.docs) {
    const any = await d.ref.collection(COLLECTIONS.entries).limit(1).get();
    if (any.empty) {
      await d.ref.delete();
      removed++;
    }
  }
  return removed;
}

export async function deleteNote(db: Firestore, uid: string, noteId: string): Promise<void> {
  await ownedNote(db, uid, noteId);
  await db.recursiveDelete(notes(db).doc(noteId));
}

/** Deletes every note of one user (bounded loop; each pass removes up to 100 notes with their entries). */
export async function deleteAllNotes(db: Firestore, uid: string): Promise<number> {
  let removed = 0;
  for (let pass = 0; pass < 100; pass++) {
    const snap = await notes(db).where("ownerUid", "==", uid).limit(100).get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      await db.recursiveDelete(d.ref);
      removed++;
    }
  }
  return removed;
}

/** All notes of a user with their entries (export). Bounded by LIMITS.notesPerUser. */
/** Notes for export, in the Archive's order: when each note was created, newest first. */
export async function allNotesPortable(db: Firestore, uid: string, noteId?: string): Promise<(PortableNote & { createdAt: number })[]> {
  if (noteId) {
    const { note, entries: list } = await getNote(db, uid, noteId);
    return [{ title: note.title, createdAt: note.createdAt, entries: list.map((e) => ({ day: e.day, body: e.body })) }];
  }
  const snap = await notes(db).where("ownerUid", "==", uid).orderBy("createdAt", "desc").limit(LIMITS.notesPerUser).get();
  const out: (PortableNote & { createdAt: number })[] = [];
  for (const d of snap.docs) {
    const n = d.data() as NoteDoc;
    const es = await d.ref.collection(COLLECTIONS.entries).orderBy("day", "asc").get();
    out.push({ title: n.title, createdAt: n.createdAt, entries: es.docs.map((e) => ({ day: e.data()["day"], body: e.data()["body"] })) });
  }
  return out;
}

/** Fingerprint of an imported note's content (title + every dated section). */
export function importHash(p: PortableNote): string {
  const h = createHash("sha256").update(p.title);
  for (const e of [...p.entries].sort((a, b) => a.day.localeCompare(b.day))) h.update(`\u0000${e.day}\u0001${e.body}`);
  return h.digest("base64url");
}

/**
 * Import parsed notes as NEW notes (never merges into existing ones). A note whose exact content was imported before
 * (same fingerprint) is skipped, so re-running an interrupted import, or importing the same file twice, never
 * creates duplicates. Returns how many notes/entries were created and how many were skipped.
 */
export async function importNotes(db: Firestore, uid: string, input: PortableNote[], now: number): Promise<{ notes: number; entries: number; skipped: number }> {
  const hashes = input.map(importHash);
  const seen = new Set<string>();
  for (let i = 0; i < hashes.length; i += 30) {
    const part = [...new Set(hashes.slice(i, i + 30))];
    const snap = await notes(db).where("ownerUid", "==", uid).where("importHash", "in", part).select("importHash").get();
    for (const d of snap.docs) seen.add(d.get("importHash") as string);
  }
  const list: { p: PortableNote; hash: string }[] = [];
  input.forEach((p, i) => {
    const hash = hashes[i]!;
    if (!seen.has(hash)) {
      seen.add(hash); // also drops duplicates inside the same chunk
      list.push({ p, hash });
    }
  });
  const skipped = input.length - list.length;
  if (list.length === 0) return { notes: 0, entries: 0, skipped };
  await assertNoteQuota(db, uid, list.length);
  let entryTotal = 0;
  for (const { p, hash } of list) {
    const id = newId();
    const valid = p.entries.filter((e) => byteLength(e.body) <= LIMITS.entryBytes).slice(0, LIMITS.entriesPerNote);
    const sorted = [...valid].sort((a, b) => a.day.localeCompare(b.day));
    const last = sorted[sorted.length - 1];
    // "Created" = when the note was first written: its earliest dated section (noon UTC keeps the calendar day in
    // every time zone), never in the future; a note without dates counts as created now.
    const firstMs = sorted[0] ? Date.parse(`${sorted[0].day}T12:00:00Z`) : NaN;
    const doc: NoteDoc = {
      ownerUid: uid,
      title: p.title || "Imported note",
      createdAt: Number.isFinite(firstMs) ? Math.min(firstMs, now) : now,
      updatedAt: now,
      firstDay: sorted[0]?.day ?? null,
      lastDay: last?.day ?? null,
      entryCount: sorted.length,
      words: sorted.reduce((n, e) => n + wordCount(e.body), 0),
      bytes: sorted.reduce((n, e) => n + byteLength(e.body), 0),
      preview: last ? preview(last.body) : "",
    };
    let batch = db.batch();
    (doc as NoteDoc & { importHash: string }).importHash = hash;
    let ops = 0;
    batch.create(notes(db).doc(id), doc);
    ops++;
    for (const e of sorted) {
      batch.set(entries(db, id).doc(e.day), { day: e.day, body: e.body, words: wordCount(e.body), bytes: byteLength(e.body), createdAt: now, updatedAt: now, ownerUid: uid, noteId: id });
      if (++ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    entryTotal += sorted.length;
  }
  await recordActivity(db, dayKey(now, "UTC"), { notes: list.length, newEntries: entryTotal });
  return { notes: list.length, entries: entryTotal, skipped };
}

export interface TimelineItem { noteId: string; noteTitle: string; day: string; words: number; preview: string; updatedAt: number }

/**
 * Timeline: every dated entry of the user, newest day first, across all notes (one collection-group query,
 * TIMELINE_PAGE_SIZE per page, plus one batched read for the note titles).
 */
export async function timeline(db: Firestore, uid: string, page = 1): Promise<{ items: TimelineItem[]; page: number; pages: number; total: number }> {
  const base = db.collectionGroup(COLLECTIONS.entries).where("ownerUid", "==", uid).orderBy("day", "desc").orderBy("updatedAt", "desc");
  // The count uses the same composite index (one read per 1000 entries).
  const total = (await base.count().get()).data().count;
  const pages = Math.max(1, Math.ceil(total / TIMELINE_PAGE_SIZE));
  page = Math.min(Math.max(1, page), 100_000);
  if (page > pages) return { items: [], page, pages, total };
  const snap = await base.offset((page - 1) * TIMELINE_PAGE_SIZE).limit(TIMELINE_PAGE_SIZE).get();
  const docs = snap.docs;
  const ids = [...new Set(docs.map((d) => d.get("noteId") as string))];
  const titles = new Map<string, string>();
  if (ids.length) {
    const refs = ids.map((id) => notes(db).doc(id));
    for (const n of await db.getAll(...refs)) if (n.exists && n.get("ownerUid") === uid) titles.set(n.id, n.get("title") as string);
  }
  const items = docs
    .filter((d) => titles.has(d.get("noteId") as string))
    .map((d) => ({
      noteId: d.get("noteId") as string,
      noteTitle: titles.get(d.get("noteId") as string) ?? "",
      day: d.get("day") as string,
      words: (d.get("words") as number) ?? 0,
      preview: preview(d.get("body") as string, 180),
      updatedAt: d.get("updatedAt") as number,
    }));
  return { items, page, pages, total };
}

/**
 * Overview for one user, about 8 reads: three aggregations (one read per 1000 index entries each), the five newest
 * notes, and the streak kept on the profile (no scan of entries).
 */
export async function overview(db: Firestore, uid: string, today: string, writing: { lastDay: string | null; streak: number }) {
  const mine = notes(db).where("ownerUid", "==", uid);
  // Two separate sums: each is served by its own (ownerUid, field) index; one combined sum would need another index.
  const [count, wordsSum, daysSum, recent] = await Promise.all([
    mine.count().get(),
    mine.aggregate({ words: AggregateField.sum("words") }).get(),
    mine.aggregate({ days: AggregateField.sum("entryCount") }).get(),
    mine.orderBy("createdAt", "desc").limit(5).get(),
  ]);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const streak = writing.lastDay === today || writing.lastDay === yesterday ? writing.streak : 0;
  return {
    today,
    writtenToday: writing.lastDay === today,
    notes: count.data().count,
    words: Number(wordsSum.data().words ?? 0),
    days: Number(daysSum.data().days ?? 0),
    streak,
    recent: recent.docs.map((d) => toMeta(d.id, d.data() as NoteDoc)),
  };
}
