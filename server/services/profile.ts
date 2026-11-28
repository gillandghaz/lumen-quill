import type { Firestore, Transaction } from "../firebase";
import { COLLECTIONS, USERNAME_CHANGE_INTERVAL_MS } from "../config";
import { HttpError } from "../errors";
import type { Role } from "../auth";
import { DEFAULT_TIME_ZONE } from "@/shared/day";
import type { HomeTab, Mode, NextDayBehavior } from "@/shared/limits";

export interface UserSettings {
  mode: Mode;
  timeZone: string;
  nextDay: NextDayBehavior;
  fontScale: number;
  homeTab: HomeTab;
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
  /** updatedAt of the custom profile photo (cache-buster); null = themed default avatar. */
  avatarVersion: number | null;
  /** Writing streak, updated when a new day is first written (so Overview needs no scan). */
  writing: { lastDay: string | null; streak: number };
  settings: UserSettings;
}

export const DEFAULT_SETTINGS: UserSettings = { mode: "sonata", timeZone: DEFAULT_TIME_ZONE, nextDay: "ask", fontScale: 1, homeTab: "overview" };

/** Reserved names cannot be taken by anyone (impersonation of staff/system). */
const RESERVED = new Set(["admin", "administrator", "root", "system", "support", "lumen", "lumenquill", "quill", "security", "staff", "owner", "help", "api", "null", "undefined"]);

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
    avatarVersion: typeof d["avatarVersion"] === "number" ? d["avatarVersion"] : null,
    writing: {
      lastDay: typeof (d["writing"] as { lastDay?: unknown } | undefined)?.lastDay === "string" ? (d["writing"] as { lastDay: string }).lastDay : null,
      streak: typeof (d["writing"] as { streak?: unknown } | undefined)?.streak === "number" ? (d["writing"] as { streak: number }).streak : 0,
    },
    settings: { ...DEFAULT_SETTINGS, ...s },
  };
}

/**
 * Profiles are read on every request (session check). They are kept for 15 s in this server instance's memory and
 * dropped whenever this instance changes them. Security is unaffected: the session signature is verified on every
 * request, and a disabled account is still refused within ~60 s (Firebase revocation check).
 */
const PROFILE_TTL_MS = 15_000;
const profileCache = new Map<string, { at: number; p: Profile | null }>();
// Bumped on every change: a read that started before a change must not put the old profile back in the cache.
let generation = 0;
const changedAt = new Map<string, number>();
export function forgetProfile(uid: string): void {
  profileCache.delete(uid);
  if (changedAt.size > 5000) changedAt.clear();
  changedAt.set(uid, ++generation);
}
export async function getProfileCached(db: Firestore, uid: string, now = Date.now()): Promise<Profile | null> {
  const hit = profileCache.get(uid);
  if (hit && now - hit.at < PROFILE_TTL_MS) return hit.p;
  const started = generation;
  const p = await getProfile(db, uid);
  if ((changedAt.get(uid) ?? 0) > started) return p; // changed while reading: use it, but do not cache it
  if (profileCache.size > 5000) profileCache.clear();
  profileCache.set(uid, { at: now, p });
  return p;
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
  }).finally(() => forgetProfile(uid));
}

export async function updateSettings(db: Firestore, uid: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  const ref = db.collection(COLLECTIONS.users).doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "not_found");
    const next = { ...normalizeProfile(uid, snap.data() ?? {}).settings, ...patch };
    tx.update(ref, { settings: next });
    return next;
  }).finally(() => forgetProfile(uid));
}
