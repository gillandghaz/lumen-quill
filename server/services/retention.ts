import { timingSafeEqual } from "node:crypto";
import type { Firestore } from "../firebase";
import { Timestamp } from "../firebase";
import { COLLECTIONS } from "../config";

/**
 * Daily clean-up (Vercel Cron). Firestore TTL policies need a billing account, which this project deliberately
 * does not have (Spark plan), so expired rate-limit counters and old audit entries are removed here instead.
 * Bounded: at most 20 passes x 200 documents per collection per run.
 */
export async function purgeExpired(db: Firestore, now: number): Promise<{ rateLimits: number; audit: number }> {
  const purge = async (collection: string) => {
    let removed = 0;
    for (let pass = 0; pass < 20; pass++) {
      const snap = await db.collection(collection).where("expiresAt", "<", Timestamp.fromMillis(now)).limit(200).get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const d of snap.docs) batch.delete(d.ref);
      await batch.commit();
      removed += snap.size;
      if (snap.size < 200) break;
    }
    return removed;
  };
  return { rateLimits: await purge(COLLECTIONS.rateLimits), audit: await purge(COLLECTIONS.audit) };
}

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. A missing/short secret refuses everything. */
export function cronAuthorized(req: Request, secret: string | undefined): boolean {
  if (!secret || secret.length < 32) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
