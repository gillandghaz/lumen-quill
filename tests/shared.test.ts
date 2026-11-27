import { describe, expect, it } from "vitest";
import { dayKey, dayLabel, isValidDay, isValidTimeZone } from "@/shared/day";
import { fileNameFor, NOTE_SEPARATOR, parseNotes, serializeNote, serializeNotes } from "@/shared/markdown-io";
import { adminCreateUserSchema, importSchema, profileSchema, saveEntrySchema, settingsSchema } from "@/shared/schemas";
import { cleanText, preview, wordCount } from "@/shared/text";
import { LIMITS } from "@/shared/limits";

describe("days", () => {
  it("computes the calendar day in the writer's time zone", () => {
    const ms = Date.UTC(2026, 10, 26, 18, 30); // 26 Nov 18:30 UTC
    expect(dayKey(ms, "UTC")).toBe("2026-11-26");
    expect(dayKey(ms, "Asia/Jakarta")).toBe("2026-11-27"); // 01:30 next day in WIB
    expect(dayKey(ms, "America/New_York")).toBe("2026-11-26");
  });
  it("falls back to the default zone for an invalid zone", () => {
    expect(dayKey(Date.UTC(2026, 10, 26, 18, 30), "Not/AZone")).toBe("2026-11-27");
  });
  it("validates days strictly", () => {
    expect(isValidDay("2026-11-26")).toBe(true);
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("2026-11-26T00:00")).toBe(false);
    expect(isValidDay("../etc")).toBe(false);
  });
  it("validates time zones", () => {
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("Asia/Jakarta; rm -rf")).toBe(false);
  });
  it("labels days in English", () => {
    expect(dayLabel("2026-11-26")).toMatch(/^Thursday,? 26 November 2026$/);
  });
});

describe("markdown interchange", () => {
  const note = { title: "Journal", entries: [{ day: "2026-11-27", body: "Second day" }, { day: "2026-11-26", body: "First day\n\n- a list\n## 2026-01-01\n# not a title" }] };

  it("round-trips a note losslessly, including lines that look like headings", () => {
    const text = serializeNote(note);
    expect(text.startsWith("# Journal\n")).toBe(true);
    expect(text.indexOf("## 2026-11-26")).toBeLessThan(text.indexOf("## 2026-11-27"));
    const [back] = parseNotes(text, "x.md", "2030-01-01");
    expect(back!.title).toBe("Journal");
    expect(back!.entries).toEqual([...note.entries].sort((a, b) => a.day.localeCompare(b.day)));
  });

  it("round-trips several notes in one file", () => {
    const two = serializeNotes([note, { title: "Ideas", entries: [{ day: "2026-11-20", body: "spark" }] }]);
    expect(two).toContain(NOTE_SEPARATOR);
    const back = parseNotes(two, "all.md", "2030-01-01");
    expect(back.map((n) => n.title)).toEqual(["Journal", "Ideas"]);
  });

  it("imports plain text without headings as one entry dated today, titled by file name", () => {
    const [n] = parseNotes("just some thoughts\nline two", "My thoughts.txt", "2026-11-26");
    expect(n).toEqual({ title: "My thoughts", entries: [{ day: "2026-11-26", body: "just some thoughts\nline two" }] });
  });

  it("strips control characters and a BOM", () => {
    const [n] = parseNotes("﻿# T\u0007itle\n\n## 2026-11-26\nok\u0000", "f.md", "2026-11-26");
    expect(n!.title).toBe("Title");
    expect(n!.entries[0]!.body).toBe("ok");
  });

  it("ignores invalid dates as headings (kept as text)", () => {
    const [n] = parseNotes("# T\n\n## 2026-02-31\nhello", "f.md", "2026-11-26");
    expect(n!.entries).toEqual([{ day: "2026-11-26", body: "## 2026-02-31\nhello" }]);
  });

  it("makes safe ASCII file names", () => {
    expect(fileNameFor('Évening "notes" / <script>', "md")).toBe("evening-notes-script.md");
    expect(fileNameFor("***", "txt")).toBe("note.txt");
  });
});

describe("schemas", () => {
  it("are strict (no mass assignment)", () => {
    expect(settingsSchema.safeParse({ mode: "palace", role: "admin" }).success).toBe(false);
    expect(saveEntrySchema.safeParse({ body: "x", ownerUid: "someone" }).success).toBe(false);
  });
  it("cap entry size in bytes", () => {
    expect(saveEntrySchema.safeParse({ body: "a".repeat(LIMITS.entryBytes) }).success).toBe(true);
    expect(saveEntrySchema.safeParse({ body: "é".repeat(LIMITS.entryBytes / 2 + 1) }).success).toBe(false);
  });
  it("normalise and validate usernames", () => {
    expect(profileSchema.parse({ username: "  QuillWriter " }).username).toBe("quillwriter");
    expect(profileSchema.safeParse({ username: "a" }).success).toBe(false);
    expect(profileSchema.safeParse({ username: "bad name" }).success).toBe(false);
    expect(profileSchema.safeParse({ username: "_edge" }).success).toBe(false);
  });
  it("only accept known modes", () => {
    expect(settingsSchema.safeParse({ mode: "neon" }).success).toBe(false);
    expect(settingsSchema.safeParse({ mode: "sonata", nextDay: "ask", timeZone: "Asia/Jakarta" }).success).toBe(true);
  });
  it("enforce password length when creating accounts", () => {
    expect(adminCreateUserSchema.safeParse({ email: "a@b.co", username: "abc", password: "short" }).success).toBe(false);
    expect(adminCreateUserSchema.safeParse({ email: "A@B.CO", username: "abc" }).data?.email).toBe("a@b.co");
  });
  it("limit import size and count", () => {
    expect(importSchema.safeParse({ files: Array.from({ length: LIMITS.importFiles + 1 }, () => ({ name: "a.md", text: "x" })) }).success).toBe(false);
    expect(importSchema.safeParse({ files: [{ name: "a.md", text: "x".repeat(LIMITS.importTotalBytes + 1) }] }).success).toBe(false);
  });
});

describe("text helpers", () => {
  it("count words and build previews", () => {
    expect(wordCount("  one two\nthree ")).toBe(3);
    expect(preview("\n\n# Heading line\nmore")).toBe("Heading line");
    expect(cleanText("a\r\nb\rc")).toBe("a\nb\nc");
  });
});
