import type { Firestore } from "../firebase";
import { FieldValue } from "../firebase";
import { COLLECTIONS } from "../config";

/**
 * Daily activity counters for Statistics: one tiny document per day (activity/{YYYY-MM-DD}), updated with
 * blind increments (no read). Statistics then reads at most ~30 small documents instead of scanning notes.
 * Old days are removed by the retention cron according to the admin's "statistics" setting.
 */
export async function recordActivity(db: Firestore, day: string, delta: { saves?: number; newEntries?: number; words?: number; notes?: number }): Promise<void> {
  try {
    await db.collection(COLLECTIONS.activity).doc(day).set(
      {
        day,
        saves: FieldValue.increment(delta.saves ?? 0),
        newEntries: FieldValue.increment(delta.newEntries ?? 0),
        words: FieldValue.increment(delta.words ?? 0),
        notes: FieldValue.increment(delta.notes ?? 0),
      },
      { merge: true },
    );
  } catch (e) {
    // Statistics must never break writing.
    console.error("activity_write_failed", e instanceof Error ? e.name : "unknown");
  }
}

export interface ActivityDay { day: string; saves: number; newEntries: number; words: number; notes: number }

export async function readActivity(db: Firestore, sinceDay: string): Promise<ActivityDay[]> {
  const snap = await db.collection(COLLECTIONS.activity).where("day", ">=", sinceDay).orderBy("day", "asc").limit(31).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return { day: x["day"], saves: x["saves"] ?? 0, newEntries: x["newEntries"] ?? 0, words: x["words"] ?? 0, notes: x["notes"] ?? 0 };
  });
}
