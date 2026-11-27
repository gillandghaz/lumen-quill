import { isValidDay } from "./day";
import { cleanText, cleanTitle } from "./text";
import { LIMITS } from "./limits";

/**
 * Plain-text interchange format (.md or .txt share the same structure; both are tiny and readable anywhere):
 *
 *   # Note title
 *
 *   ## 2026-11-26
 *   text of that day...
 *
 *   ## 2026-11-27
 *   ...
 *
 * Several notes in one file are separated by a line containing exactly `<!-- lumen:note -->`.
 * Text before the first date heading (e.g. a plain file from elsewhere) is imported as an entry dated `fallbackDay`.
 * Body lines that would be mistaken for our headings are escaped with a leading backslash, so a round trip is lossless.
 */
export const NOTE_SEPARATOR = "<!-- lumen:note -->";
const DAY_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const TITLE_HEADING = /^#\s+/;

export interface PortableEntry { day: string; body: string }
export interface PortableNote { title: string; entries: PortableEntry[] }

const needsEscape = (l: string) => DAY_HEADING.test(l) || l.trim() === NOTE_SEPARATOR || TITLE_HEADING.test(l) || /^\\+(##\s|#\s|<!--)/.test(l);

function escapeBody(body: string): string {
  return body.split("\n").map((l) => (needsEscape(l) ? `\\${l}` : l)).join("\n");
}

function unescapeLine(l: string): string {
  return l.startsWith("\\") && needsEscape(l.slice(1)) ? l.slice(1) : l;
}

export function serializeNote(note: PortableNote): string {
  const lines: string[] = [`# ${note.title || "Untitled"}`, ""];
  for (const e of [...note.entries].sort((a, b) => a.day.localeCompare(b.day))) {
    lines.push(`## ${e.day}`, "", escapeBody(e.body.replace(/\s+$/, "")), "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function serializeNotes(notes: PortableNote[]): string {
  return notes.map(serializeNote).join(`\n${NOTE_SEPARATOR}\n\n`);
}

export function parseNotes(raw: string, fileName: string, fallbackDay: string): PortableNote[] {
  const text = cleanText(raw).replace(/^﻿/, "");
  const chunks: string[][] = [[]];
  for (const line of text.split("\n")) {
    if (line.trim() === NOTE_SEPARATOR) chunks.push([]);
    else chunks[chunks.length - 1]!.push(line);
  }
  const base = fileName.replace(/\.(md|markdown|txt)$/i, "");
  return chunks.map((lines) => parseOne(lines, base, fallbackDay)).filter((n): n is PortableNote => n !== null);
}

function parseOne(lines: string[], fallbackTitle: string, fallbackDay: string): PortableNote | null {
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  let title = "";
  const first = lines[i];
  if (first !== undefined && TITLE_HEADING.test(first)) {
    title = cleanTitle(first.replace(TITLE_HEADING, ""));
    i++;
  }
  const entries = new Map<string, string[]>();
  const preamble: string[] = [];
  let current: string[] | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const m = DAY_HEADING.exec(line);
    if (m && isValidDay(m[1])) {
      const day = m[1]!;
      current = entries.get(day) ?? [];
      entries.set(day, current);
      continue;
    }
    (current ?? preamble).push(unescapeLine(line));
  }
  const pre = preamble.join("\n").trim();
  if (pre) {
    const existing = (entries.get(fallbackDay) ?? []).join("\n").trim();
    entries.set(fallbackDay, existing ? [pre, "", existing] : [pre]);
  }
  const list = [...entries.entries()]
    .map(([day, body]) => ({ day, body: body.join("\n").trim() }))
    .filter((e) => e.body.length > 0)
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, LIMITS.entriesPerNote);
  if (!title && list.length === 0) return null;
  return { title: (title || cleanTitle(fallbackTitle) || "Imported note").slice(0, LIMITS.titleChars), entries: list };
}

/** Safe ASCII file name for downloads. */
export function fileNameFor(title: string, ext: "md" | "txt"): string {
  const slug = title.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 60);
  return `${slug || "note"}.${ext}`;
}
