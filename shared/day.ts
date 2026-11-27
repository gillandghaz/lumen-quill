/** Calendar-day helpers. A "day" is the YYYY-MM-DD date in the writer's own time zone. */
export const DAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length < 1 || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The day (YYYY-MM-DD) of `ms` in time zone `tz`. */
export function dayKey(ms: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isValidDay(day: unknown): day is string {
  if (typeof day !== "string" || !DAY_PATTERN.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/** "Wednesday, 26 November 2026" (always English, UTC-anchored so the label never shifts). */
export function dayLabel(day: string): string {
  if (!isValidDay(day)) return day;
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** "26 Nov 2026" */
export function shortDayLabel(day: string): string {
  if (!isValidDay(day)) return day;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}
