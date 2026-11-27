import type { Firestore } from "../firebase";
import { Timestamp } from "../firebase";
import { COLLECTIONS } from "../config";

/** Audit entries are kept for the admin's audit retention (1/3/7/30 days, removed by the daily cron). Only ids, codes and counts: never note text or e-mail. */
const AUDIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AuditAction =
  | "auth.login"
  | "auth.denied"
  | "auth.logout_all"
  | "account.username"
  | "account.password"
  | "data.import"
  | "data.delete_all"
  | "note.delete"
  | "admin.user_create"
  | "admin.user_disable"
  | "admin.user_enable"
  | "admin.user_revoke"
  | "admin.user_delete"
  | "admin.backup"
  | "admin.revoke_all"
  | "admin.retention";

export interface AuditEntry {
  action: AuditAction;
  actorUid: string | null;
  targetUid?: string;
  details?: Record<string, string | number | boolean>;
}

export async function writeAudit(db: Firestore, e: AuditEntry, now: number): Promise<void> {
  try {
    await db.collection(COLLECTIONS.audit).add({ ...e, at: now, expiresAt: Timestamp.fromMillis(now + AUDIT_TTL_MS) });
  } catch (err) {
    // Auditing must never break the user's action; the failure itself is logged without personal data.
    console.error("audit_write_failed", err instanceof Error ? err.name : "unknown");
  }
}
