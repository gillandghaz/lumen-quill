import type { Firestore, Transaction } from "../firebase";
import { COLLECTIONS, USERNAME_CHANGE_INTERVAL_MS } from "../config";
import { HttpError } from "../errors";
import type { Role } from "../auth";
import { DEFAULT_TIME_ZONE } from "@/shared/day";
import type { Mode, NextDayBehavior } from "@/shared/limits";

export interface UserSettings {
  mode: Mode;
  timeZone: string;
  nextDay: NextDayBehavior;
  fontScale: number;
}

export interface Profile {
  uid: string;
  email: string;
  username: string;
  role: Role;
  disabled: boolean;
  createdAt: number;
  createdBy: string;
  lastLoginAt: number | null;
  usernameChangedAt: number | null;
  settings: UserSettings;
}

export const DEFAULT_SETTINGS: UserSettings = { mode: "sonata", timeZone: DEFAULT_TIME_ZONE, nextDay: "ask", fontScale: 1 };

/** Reserved names cannot be taken by anyone (impersonation of staff/system). */
const RESERVED = new Set(["admin", "administrator", "root", "system", "support", "lumine", "luminearchive", "security", "staff", "owner", "help", "api", "null", "undefined"]);

export function normalizeProfile(uid: string, d: Record<string, unknown>): Profile {
  const s = (d["settings"] ?? {}) as Partial<UserSettings>;
  return {
    uid,
    email: typeof d["email"] === "string" ? d["email"] : "",
    username: typeof d["username"] === "string" ? d["username"] : "",
    role: d["role"] === "admin" ? "admin" : "user",
    disabled: d["disabled"] === true,
    createdAt: typeof d["createdAt"] === "number" ? d["createdAt"] : 0,
    createdBy: typeof d["createdBy"] === "string" ? d["createdBy"] : "",
    lastLoginAt: typeof d["lastLoginAt"] === "number" ? d["lastLoginAt"] : null,
    usernameChangedAt: typeof d["usernameChangedAt"] === "number" ? d["usernameChangedAt"] : null,
    settings: { ...DEFAULT_SETTINGS, ...s },
  };
}

export async function getProfile(db: Firestore, uid: string): Promise<Profile | null> {
  const snap = await db.collection(COLLECTIONS.users).doc(uid).get();
  return snap.exists ? normalizeProfile(uid, snap.data() ?? {}) : null;
}

/** Reserve a username inside a transaction (usernames/{name} -> uid). Throws username_taken / username_reserved. */
export async function reserveUsername(tx: Transaction, db: Firestore, uid: string, username: string, allowReserved = false): Promise<void> {
  if (!allowReserved && RESERVED.has(username)) throw new HttpError(409, "username_reserved");
  const ref = db.collection(COLLECTIONS.usernames).doc(username);
  const snap = await tx.get(ref);
  if (snap.exists && snap.data()?.["uid"] !== uid) throw new HttpError(409, "username_taken");
  tx.set(ref, { uid });
}

export async function changeUsername(db: Firestore, uid: string, username: string, now: number): Promise<string> {
  return db.runTransaction(async (tx) => {
    const userRef = db.collection(COLLECTIONS.users).doc(uid);
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpError(404, "not_found");
    const p = normalizeProfile(uid, snap.data() ?? {});
    if (p.username === username) return username;
    if (p.usernameChangedAt && now - p.usernameChangedAt < USERNAME_CHANGE_INTERVAL_MS) throw new HttpError(429, "username_too_soon");
    await reserveUsername(tx, db, uid, username);
    if (p.username) tx.delete(db.collection(COLLECTIONS.usernames).doc(p.username));
    tx.update(userRef, { username, usernameChangedAt: now });
    return username;
  });
}

export async function updateSettings(db: Firestore, uid: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  const ref = db.collection(COLLECTIONS.users).doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "not_found");
    const next = { ...normalizeProfile(uid, snap.data() ?? {}).settings, ...patch };
    tx.update(ref, { settings: next });
    return next;
  });
}
