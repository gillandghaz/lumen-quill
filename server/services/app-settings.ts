import type { Firestore } from "../firebase";
import { COLLECTIONS } from "../config";
import type { RetentionDays } from "@/shared/limits";

/** Global admin settings (appSettings/retention). */
export interface Retention {
  /** Days of daily activity counters kept for Statistics. */
  statsDays: RetentionDays;
  /** Days of audit log (sign-ins, admin actions) kept for Security / Audit log. */
  auditDays: RetentionDays;
}

export const DEFAULT_RETENTION: Retention = { statsDays: 30, auditDays: 30 };
const ALLOWED = new Set([1, 3, 7, 30]);

export async function getRetention(db: Firestore): Promise<Retention> {
  const snap = await db.collection(COLLECTIONS.appSettings).doc("retention").get();
  const d = snap.data() ?? {};
  return {
    statsDays: ALLOWED.has(d["statsDays"]) ? d["statsDays"] : DEFAULT_RETENTION.statsDays,
    auditDays: ALLOWED.has(d["auditDays"]) ? d["auditDays"] : DEFAULT_RETENTION.auditDays,
  };
}

export async function setRetention(db: Firestore, patch: Partial<Retention>): Promise<Retention> {
  const next = { ...(await getRetention(db)), ...patch };
  await db.collection(COLLECTIONS.appSettings).doc("retention").set(next);
  return next;
}
