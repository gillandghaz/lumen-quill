import { timingSafeEqual } from "node:crypto";
import type { Firestore } from "../firebase";
import { Timestamp, type Query } from "../firebase";
import { COLLECTIONS } from "../config";
import { dayKey } from "@/shared/day";
import { getRetention } from "./app-settings";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clean-up (daily Vercel Cron, and right after the admin changes a retention setting).
 * Firestore TTL policies need a billing account, which this Spark project deliberately does not have.
 * - rate-limit counters: past their window
 * - activity (Statistics): older than the admin's statistics retention (1/3/7/30 days)
 * - audit log (Security / Audit log): older than the admin's audit retention (1/3/7/30 days)
 * Bounded: at most 20 passes x 200 documents per collection per run.
 */
export async function purgeExpired(db: Firestore, now: number): Promise<{ rateLimits: number; activity: number; audit: number }> {
  const r = await getRetention(db);
  const purge = async (q: () => Query) => {
    let removed = 0;
    for (let pass = 0; pass < 20; pass++) {
      const snap = await q().limit(200).get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const d of snap.docs) batch.delete(d.ref);
      await batch.commit();
      removed += snap.size;
      if (snap.size < 200) break;
    }
    return removed;
  };
  const statsCutoffDay = dayKey(now - (r.statsDays - 1) * DAY_MS, "UTC");
  return {
    rateLimits: await purge(() => db.collection(COLLECTIONS.rateLimits).where("expiresAt", "<", Timestamp.fromMillis(now))),
    activity: await purge(() => db.collection(COLLECTIONS.activity).where("day", "<", statsCutoffDay)),
    audit: await purge(() => db.collection(COLLECTIONS.audit).where("at", "<", now - r.auditDays * DAY_MS)),
  };
}

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. A missing/short secret refuses everything. */
export function cronAuthorized(req: Request, secret: string | undefined): boolean {
  if (!secret || secret.length < 32) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
