"use client";

import { parseNotes, type PortableNote } from "@/shared/markdown-io";
import { LIMITS } from "@/shared/limits";
import { byteLength } from "@/shared/text";
import { api, ApiError } from "./api";

export interface ImportPlan {
  files: number;
  skippedFiles: string[];
  notes: PortableNote[];
  days: number;
  bytes: number;
}

export interface ImportProgress { sent: number; total: number; created: number; skipped: number; entries: number }
export type ImportOutcome =
  | { ok: true; progress: ImportProgress }
  | { ok: false; progress: ImportProgress; reason: "quota" | "rate" | "error"; message: string };

/**
 * Read and parse every chosen file in the browser (nothing is uploaded yet). Text before the first date heading is
 * dated `today` (the writer's own calendar day). Oversized days are left out and reported by the server limits.
 */
export async function planImport(fileList: File[], today: string): Promise<ImportPlan> {
  const files = fileList.filter((f) => /\.(md|markdown|txt)$/i.test(f.name));
  const skippedFiles = fileList.filter((f) => !files.includes(f)).map((f) => f.name);
  if (files.length > LIMITS.importMaxFiles) throw new Error(`Choose at most ${LIMITS.importMaxFiles} files at once.`);
  const bytes = files.reduce((n, f) => n + f.size, 0);
  if (bytes > LIMITS.importMaxBytes) throw new Error("Those files are larger than 50 MB together. Import them in parts.");
  const notes: PortableNote[] = [];
  for (const f of files) {
    const text = await f.text();
    for (const n of parseNotes(text, f.name, today)) {
      const entries = n.entries.filter((e) => byteLength(e.body) <= LIMITS.entryBytes && e.day <= today);
      if (entries.length || n.title) notes.push({ title: n.title.slice(0, LIMITS.titleChars), entries });
    }
  }
  return { files: files.length, skippedFiles, notes, days: notes.reduce((n, x) => n + x.entries.length, 0), bytes };
}

/** Split into requests of ≤ 50 notes and ≤ ~1.4 MB (a single huge note travels alone). */
function chunks(notes: PortableNote[]): PortableNote[][] {
  const out: PortableNote[][] = [];
  let cur: PortableNote[] = [];
  let size = 0;
  for (const n of notes) {
    const s = byteLength(JSON.stringify(n));
    if (cur.length && (cur.length >= LIMITS.importChunkNotes || size + s > LIMITS.importChunkBytes - 100_000)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(n);
    size += s;
  }
  if (cur.length) out.push(cur);
  return out;
}

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Send the plan chunk by chunk. A rate limit pauses and retries; a full daily database quota stops cleanly.
 * Running the same import again later is safe: notes already imported are skipped by the server.
 */
export async function runImport(notes: PortableNote[], onProgress: (p: ImportProgress) => void): Promise<ImportOutcome> {
  const p: ImportProgress = { sent: 0, total: notes.length, created: 0, skipped: 0, entries: 0 };
  onProgress({ ...p });
  for (const chunk of chunks(notes)) {
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await api<{ notes: number; entries: number; skipped: number }>("/api/data/import", { method: "POST", body: { notes: chunk } });
        p.sent += chunk.length;
        p.created += r.notes;
        p.skipped += r.skipped;
        p.entries += r.entries;
        onProgress({ ...p });
        break;
      } catch (e) {
        if (e instanceof ApiError && e.status === 429 && attempt < 3) {
          await wait(Math.min(60, Number(e.data["retryAfterSec"] ?? 20)) * 1000);
          continue;
        }
        if (e instanceof ApiError && e.status === 503) {
          return { ok: false, progress: p, reason: "quota", message: "The database's daily write limit was reached. Run the same import again tomorrow; notes already imported are skipped." };
        }
        if (e instanceof ApiError && e.status === 429) {
          return { ok: false, progress: p, reason: "rate", message: "Too many imports in a short time. Wait a while and run the same import again; nothing will be duplicated." };
        }
        return { ok: false, progress: p, reason: "error", message: e instanceof ApiError ? e.code : "network" };
      }
    }
  }
  return { ok: true, progress: p };
}
