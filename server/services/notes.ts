import { randomBytes } from "node:crypto";
import type { Firestore } from "../firebase";
import { COLLECTIONS } from "../config";
import { HttpError } from "../errors";
import { LIMITS } from "@/shared/limits";
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

const PAGE = 30;

export async function listNotes(db: Firestore, uid: string, opts: { cursor?: string; q?: string }): Promise<{ items: NoteMeta[]; nextCursor: string | null }> {
  if (opts.q && opts.q.trim()) {
    // Title / preview search over the user's most recent notes (bounded scan; caller rate-limits it).
    const needle = opts.q.trim().toLowerCase();
    const snap = await notes(db).where("ownerUid", "==", uid).orderBy("updatedAt", "desc").limit(500).get();
    const items = snap.docs.map((d) => toMeta(d.id, d.data() as NoteDoc)).filter((n) => n.title.toLowerCase().includes(needle) || n.preview.toLowerCase().includes(needle));
    return { items: items.slice(0, 100), nextCursor: null };
  }
  let q = notes(db).where("ownerUid", "==", uid).orderBy("updatedAt", "desc").limit(PAGE + 1);
  if (opts.cursor) {
    const at = Number(opts.cursor);
    if (!Number.isFinite(at) || at < 0) throw new HttpError(400, "bad_request");
    q = q.startAfter(at);
  }
  const snap = await q.get();
  const docs = snap.docs.slice(0, PAGE);
  const items = docs.map((d) => toMeta(d.id, d.data() as NoteDoc));
  return { items, nextCursor: snap.docs.length > PAGE && items.length ? String(items[items.length - 1]!.updatedAt) : null };
}

/** The note "Write" should open, and today's date for this user. */
export async function writeTarget(db: Firestore, uid: string, timeZone: string, now: number) {
  const today = todayFor(timeZone, now);
  const snap = await notes(db).where("ownerUid", "==", uid).orderBy("updatedAt", "desc").limit(1).get();
  const d = snap.docs[0];
  const latest = d ? toMeta(d.id, d.data() as NoteDoc) : null;
  return { today, latest, writtenToday: latest?.lastDay === today };
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
 * - Writing is only allowed into TODAY (creating it on first save) or into a day that already exists (editing).
 *   The server decides what "today" is from the user's time zone; the client cannot invent dates.
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
  return db.runTransaction(async (tx) => {
    const [ns, es] = await Promise.all([tx.get(noteRef), tx.get(entryRef)]);
    const n = ns.data() as NoteDoc | undefined;
    if (!ns.exists || !n || n.ownerUid !== uid) throw new HttpError(404, "not_found");
    const prev = es.exists ? (es.data() as Entry & { bytes?: number }) : null;
    if (!prev && day !== today) throw new HttpError(404, "not_found");
    if (prev && typeof baseUpdatedAt === "number" && prev.updatedAt > baseUpdatedAt) {
      throw new HttpError(409, "conflict", { public: { updatedAt: prev.updatedAt } });
    }
    if (!prev && body.trim() === "") return { entry: null, note: toMeta(noteId, n) }; // nothing to create yet
    if (!prev && (n.entryCount ?? 0) >= LIMITS.entriesPerNote) throw new HttpError(409, "entry_limit");

    const words = wordCount(body);
    const bytes = byteLength(body);
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
export async function allNotesPortable(db: Firestore, uid: string, noteId?: string): Promise<PortableNote[]> {
  if (noteId) {
    const { note, entries: list } = await getNote(db, uid, noteId);
    return [{ title: note.title, entries: list.map((e) => ({ day: e.day, body: e.body })) }];
  }
  const snap = await notes(db).where("ownerUid", "==", uid).orderBy("updatedAt", "desc").limit(LIMITS.notesPerUser).get();
  const out: PortableNote[] = [];
  for (const d of snap.docs) {
    const es = await d.ref.collection(COLLECTIONS.entries).orderBy("day", "asc").get();
    out.push({ title: (d.data() as NoteDoc).title, entries: es.docs.map((e) => ({ day: e.data()["day"], body: e.data()["body"] })) });
  }
  return out;
}

/** Import parsed notes as NEW notes (never merges into existing ones). Returns how many notes/entries were created. */
export async function importNotes(db: Firestore, uid: string, list: PortableNote[], now: number): Promise<{ notes: number; entries: number }> {
  await assertNoteQuota(db, uid, list.length);
  let entryTotal = 0;
  for (const p of list) {
    const id = newId();
    const valid = p.entries.filter((e) => byteLength(e.body) <= LIMITS.entryBytes).slice(0, LIMITS.entriesPerNote);
    const sorted = [...valid].sort((a, b) => a.day.localeCompare(b.day));
    const last = sorted[sorted.length - 1];
    const doc: NoteDoc = {
      ownerUid: uid,
      title: p.title || "Imported note",
      createdAt: now,
      updatedAt: now,
      firstDay: sorted[0]?.day ?? null,
      lastDay: last?.day ?? null,
      entryCount: sorted.length,
      words: sorted.reduce((n, e) => n + wordCount(e.body), 0),
      bytes: sorted.reduce((n, e) => n + byteLength(e.body), 0),
      preview: last ? preview(last.body) : "",
    };
    let batch = db.batch();
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
  return { notes: list.length, entries: entryTotal };
}
