import { describe, expect, it } from "vitest";
import { avatarSchema, backupQuery, passwordCreateSchema, retentionSchema, settingsSchema } from "@/shared/schemas";
import { HOME_TABS, isHomeTab } from "@/shared/limits";

describe("settings", () => {
  it("accept only the three Home tabs", () => {
    expect(HOME_TABS).toEqual(["overview", "notes", "archive"]);
    expect(settingsSchema.safeParse({ homeTab: "archive" }).success).toBe(true);
    expect(settingsSchema.safeParse({ homeTab: "admin" }).success).toBe(false);
    expect(isHomeTab("timeline")).toBe(false);
  });
});

describe("retention", () => {
  it("allows exactly 1, 3, 7 or 30 days", () => {
    for (const d of [1, 3, 7, 30]) expect(retentionSchema.safeParse({ statsDays: d, auditDays: d }).success).toBe(true);
    for (const d of [0, 2, 14, 31, 365, -1]) expect(retentionSchema.safeParse({ statsDays: d }).success).toBe(false);
    expect(retentionSchema.safeParse({ statsDays: 7, extra: 1 }).success).toBe(false);
  });
});

describe("avatar upload", () => {
  it("accepts only a JPEG data URL of bounded size", () => {
    expect(avatarSchema.safeParse({ image: "data:image/jpeg;base64,/9j/4AAQSkZJRg==" }).success).toBe(true);
    expect(avatarSchema.safeParse({ image: "data:image/png;base64,iVBORw0KGgo=" }).success).toBe(false);
    expect(avatarSchema.safeParse({ image: "data:image/svg+xml;base64,PHN2Zz4=" }).success).toBe(false);
    expect(avatarSchema.safeParse({ image: "https://evil.example/x.jpg" }).success).toBe(false);
    expect(avatarSchema.safeParse({ image: "data:image/jpeg;base64," + "A".repeat(130_000) }).success).toBe(false);
  });
});

describe("backup range", () => {
  it("validates dates", () => {
    expect(backupQuery.safeParse({ from: "2026-11-01", to: "2026-11-27" }).success).toBe(true);
    expect(backupQuery.safeParse({ from: "2026-13-01" }).success).toBe(false);
    expect(backupQuery.safeParse({ from: "yesterday" }).success).toBe(false);
  });
});

describe("password creation", () => {
  it("needs at least 12 characters", () => {
    expect(passwordCreateSchema.safeParse({ password: "short" }).success).toBe(false);
    expect(passwordCreateSchema.safeParse({ password: "a-long-enough-pass" }).success).toBe(true);
  });
});
