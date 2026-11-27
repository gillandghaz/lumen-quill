import { firestore, Timestamp, type Firestore } from "./firebase";
import { FirebaseAuthProvider, type AuthProvider } from "./auth";
import { COLLECTIONS, RATE_LIMIT_GRACE_MS, loadConfig, type AppConfig } from "./config";
import { RateLimiter, type RateStore } from "./security/rate-limit";

export interface Deps {
  db: Firestore;
  auth: AuthProvider;
  config: AppConfig;
  now: () => number;
  limiter: RateLimiter;
}

/**
 * Rate-limit counters in Firestore: one transaction per hit (shared by all serverless instances).
 * Expired counters (`expiresAt`) are deleted by the daily cron (server/services/retention.ts).
 */
export class FirestoreRateStore implements RateStore {
  constructor(private readonly db: Firestore) {}
  hit(id: string, now: number, windowMs: number) {
    const ref = this.db.collection(COLLECTIONS.rateLimits).doc(id);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? (snap.data() as { count: number; windowStart: number }) : null;
      const fresh = !cur || now - cur.windowStart >= windowMs;
      const next = fresh ? { count: 1, windowStart: now } : { count: cur.count + 1, windowStart: cur.windowStart };
      tx.set(ref, { ...next, expiresAt: Timestamp.fromMillis(next.windowStart + windowMs + RATE_LIMIT_GRACE_MS) });
      return next;
    });
  }
}

let cached: Deps | null = null;

/** Production dependencies. Throws when configuration is incomplete (no silent fallback). */
export function getDeps(): Deps {
  if (!cached) {
    const db = firestore();
    const now = () => Date.now();
    const config = loadConfig();
    cached = { db, auth: new FirebaseAuthProvider(now), config, now, limiter: new RateLimiter(new FirestoreRateStore(db), config.rateLimitSecret, now) };
  }
  return cached;
}
