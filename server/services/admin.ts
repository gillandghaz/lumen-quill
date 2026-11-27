import type { Deps } from "../deps";
import { AggregateField, adminAuth, serviceAccessToken } from "../firebase";
import { COLLECTIONS, SESSION_TTL_MS } from "../config";
import { HttpError } from "../errors";
import { authErrorCode } from "../auth";
import type { CurrentUser } from "../session";
import { DEFAULT_SETTINGS, normalizeProfile, reserveUsername, type Profile } from "./profile";
import { deleteAllNotes } from "./notes";
import { writeAudit } from "./audit";
import { readActivity } from "./activity";
import { getRetention } from "./app-settings";
import { dayKey } from "@/shared/day";

export interface AdminUserView {
  uid: string;
  email: string;
  username: string;
  role: "admin" | "user";
  disabled: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  notes: number;
  providers: string[];
  avatarVersion: number | null;
}

export async function listUsers(deps: Deps): Promise<AdminUserView[]> {
  const snap = await deps.db.collection(COLLECTIONS.users).orderBy("createdAt", "asc").limit(200).get();
  const profiles = snap.docs.map((d) => normalizeProfile(d.id, d.data()));
  const [counts, records] = await Promise.all([
    Promise.all(profiles.map((p) => deps.db.collection(COLLECTIONS.notes).where("ownerUid", "==", p.uid).count().get().then((c) => c.data().count))),
    profiles.length ? adminAuth().getUsers(profiles.map((p) => ({ uid: p.uid }))) : Promise.resolve({ users: [] }),
  ]);
  const byUid = new Map(records.users.map((u) => [u.uid, u]));
  return profiles.map((p, i) => ({
    uid: p.uid,
    email: p.email,
    username: p.username,
    role: p.role,
    disabled: p.disabled || byUid.get(p.uid)?.disabled === true,
    createdAt: p.createdAt,
    lastLoginAt: p.lastLoginAt,
    notes: counts[i] ?? 0,
    providers: byUid.get(p.uid)?.providerData.map((x) => x.providerId) ?? [],
    avatarVersion: p.avatarVersion,
  }));
}

/**
 * Accounts are created ONLY here, by the admin (there is no public sign-up). The Firebase account and the app
 * profile are created together; if the profile step fails the Firebase account is removed again.
 * Created accounts are always role "user": there is exactly one admin (set by scripts/bootstrap-admin.mjs).
 */
export async function createUser(deps: Deps, admin: CurrentUser, input: { email: string; username: string; password?: string }): Promise<AdminUserView> {
  let uid: string;
  try {
    const rec = await adminAuth().createUser({ email: input.email, emailVerified: true, displayName: input.username, ...(input.password ? { password: input.password } : {}) });
    uid = rec.uid;
  } catch (e) {
    const code = authErrorCode(e);
    if (code === "auth/email-already-exists") throw new HttpError(409, "email_taken");
    if (code === "auth/invalid-password" || code === "auth/password-does-not-meet-requirements") throw new HttpError(400, "weak_password");
    if (code === "auth/invalid-email") throw new HttpError(400, "bad_request");
    throw e;
  }
  const now = deps.now();
  try {
    await deps.db.runTransaction(async (tx) => {
      await reserveUsername(tx, deps.db, uid, input.username);
      const profile: Omit<Profile, "uid"> = {
        email: input.email,
        username: input.username,
        role: "user",
        disabled: false,
        createdAt: now,
        createdBy: admin.identity.uid,
        lastLoginAt: null,
        usernameChangedAt: null,
        avatarVersion: null,
        settings: DEFAULT_SETTINGS,
      };
      tx.create(deps.db.collection(COLLECTIONS.users).doc(uid), profile);
    });
  } catch (e) {
    await adminAuth().deleteUser(uid).catch(() => undefined);
    throw e;
  }
  await writeAudit(deps.db, { action: "admin.user_create", actorUid: admin.identity.uid, targetUid: uid, details: { password: Boolean(input.password) } }, now);
  return { uid, email: input.email, username: input.username, role: "user", disabled: false, createdAt: now, lastLoginAt: null, notes: 0, providers: input.password ? ["password"] : [], avatarVersion: null };
}

async function targetUser(deps: Deps, admin: CurrentUser, uid: string): Promise<Profile> {
  if (uid === admin.identity.uid) throw new HttpError(400, "cannot_target_self");
  const snap = await deps.db.collection(COLLECTIONS.users).doc(uid).get();
  if (!snap.exists) throw new HttpError(404, "not_found");
  const p = normalizeProfile(uid, snap.data() ?? {});
  if (p.role === "admin") throw new HttpError(403, "forbidden");
  return p;
}

/** Disable = Firebase "disabled" (no new tokens) + profile flag (existing cookies refused) + revoke refresh tokens. */
export async function setDisabled(deps: Deps, admin: CurrentUser, uid: string, disabled: boolean): Promise<void> {
  await targetUser(deps, admin, uid);
  await adminAuth().updateUser(uid, { disabled });
  await deps.db.collection(COLLECTIONS.users).doc(uid).update({ disabled });
  if (disabled) await deps.auth.revokeAllSessions(uid);
  await writeAudit(deps.db, { action: disabled ? "admin.user_disable" : "admin.user_enable", actorUid: admin.identity.uid, targetUid: uid }, deps.now());
}

export async function revokeUser(deps: Deps, admin: CurrentUser, uid: string): Promise<void> {
  await targetUser(deps, admin, uid);
  await deps.auth.revokeAllSessions(uid);
  await writeAudit(deps.db, { action: "admin.user_revoke", actorUid: admin.identity.uid, targetUid: uid }, deps.now());
}

/** Permanently deletes the account AND all of its notes. */
export async function deleteUser(deps: Deps, admin: CurrentUser, uid: string): Promise<{ notes: number }> {
  const p = await targetUser(deps, admin, uid);
  await adminAuth().updateUser(uid, { disabled: true }).catch(() => undefined);
  await deps.auth.revokeAllSessions(uid).catch(() => undefined);
  const removed = await deleteAllNotes(deps.db, uid);
  const batch = deps.db.batch();
  batch.delete(deps.db.collection(COLLECTIONS.users).doc(uid));
  batch.delete(deps.db.collection(COLLECTIONS.avatars).doc(uid));
  if (p.username) batch.delete(deps.db.collection(COLLECTIONS.usernames).doc(p.username));
  await batch.commit();
  await adminAuth().deleteUser(uid).catch((e) => {
    if (authErrorCode(e) !== "auth/user-not-found") throw e;
  });
  await writeAudit(deps.db, { action: "admin.user_delete", actorUid: admin.identity.uid, targetUid: uid, details: { notes: removed } }, deps.now());
  return { notes: removed };
}

/** Sign every account except the admin's current one out of all devices. */
export async function revokeEveryone(deps: Deps, admin: CurrentUser): Promise<number> {
  const snap = await deps.db.collection(COLLECTIONS.users).limit(500).get();
  let n = 0;
  for (const d of snap.docs) {
    if (d.id === admin.identity.uid) continue;
    await deps.auth.revokeAllSessions(d.id);
    n++;
  }
  await writeAudit(deps.db, { action: "admin.revoke_all", actorUid: admin.identity.uid, details: { accounts: n } }, deps.now());
  return n;
}

export async function listAudit(deps: Deps, cursor?: string) {
  let q = deps.db.collection(COLLECTIONS.audit).orderBy("at", "desc").limit(51);
  if (cursor) {
    const at = Number(cursor);
    if (!Number.isFinite(at)) throw new HttpError(400, "bad_request");
    q = q.startAfter(at);
  }
  const snap = await q.get();
  const items = snap.docs.slice(0, 50).map((d) => {
    const x = d.data();
    return { id: d.id, action: x["action"], actorUid: x["actorUid"] ?? null, targetUid: x["targetUid"] ?? null, at: x["at"], details: x["details"] ?? {} };
  });
  return { items, nextCursor: snap.docs.length > 50 && items.length ? String(items[items.length - 1]!.at) : null };
}

/**
 * Statistics without scanning notes: totals are aggregation queries (one read per 1000 index entries) and the
 * activity chart reads the small daily counters (activity/{day}) kept for the admin's statistics retention window.
 */
export async function stats(deps: Deps) {
  const db = deps.db;
  const retention = await getRetention(db);
  const since = dayKey(deps.now() - (retention.statsDays - 1) * 86_400_000, "UTC");
  const [users, notes, entries, wordsAgg, activity] = await Promise.all([
    db.collection(COLLECTIONS.users).count().get(),
    db.collection(COLLECTIONS.notes).count().get(),
    db.collectionGroup(COLLECTIONS.entries).count().get(),
    db.collection(COLLECTIONS.notes).aggregate({ words: AggregateField.sum("words") }).get(),
    readActivity(db, since),
  ]);
  return {
    users: users.data().count,
    notes: notes.data().count,
    entries: entries.data().count,
    words: Number(wordsAgg.data().words ?? 0),
    activity,
    retention,
  };
}

/**
 * Backup, one page at a time (Vercel limits a response to ~4.5 MB): profiles on the first page, then notes with their
 * entries, 25 notes per page. The browser joins the pages into one JSON file. Read-only, rate-limited and audited.
 * Optional `from` / `to` (YYYY-MM-DD, inclusive) keep only entries written on those days, and only notes that have one.
 */
export async function backupPage(deps: Deps, admin: CurrentUser, opts: { cursor?: string; from?: string; to?: string }) {
  const db = deps.db;
  const first = !opts.cursor;
  if (opts.from && opts.to && opts.from > opts.to) throw new HttpError(400, "bad_range");
  let q = db.collection(COLLECTIONS.notes).orderBy("createdAt", "asc").limit(26);
  if (opts.cursor) {
    const at = Number(opts.cursor);
    if (!Number.isFinite(at)) throw new HttpError(400, "bad_request");
    q = q.startAfter(at);
  }
  const snap = await q.get();
  const docs = snap.docs.slice(0, 25);
  const ranged = Boolean(opts.from || opts.to);
  const notes = (await Promise.all(docs.map(async (d) => {
    let eq = d.ref.collection(COLLECTIONS.entries).orderBy("day", "asc");
    if (opts.from) eq = eq.where("day", ">=", opts.from);
    if (opts.to) eq = eq.where("day", "<=", opts.to);
    const es = await eq.get();
    return { id: d.id, ...d.data(), entries: es.docs.map((e) => e.data()) };
  }))).filter((n) => !ranged || n.entries.length > 0);
  const users = first ? (await db.collection(COLLECTIONS.users).limit(500).get()).docs.map((d) => ({ uid: d.id, ...d.data() })) : undefined;
  if (first) await writeAudit(db, { action: "admin.backup", actorUid: admin.identity.uid, details: { from: opts.from ?? "", to: opts.to ?? "" } }, deps.now());
  return { users, notes, nextCursor: snap.docs.length > 25 && docs.length ? String(docs[docs.length - 1]!.get("createdAt")) : null };
}

/** Live security posture: app settings plus the Firebase Auth project configuration (read-only, no secrets). */
export async function securityStatus(deps: Deps) {
  const checks: { key: string; ok: boolean; detail: string }[] = [];
  checks.push({ key: "Session cookie", ok: true, detail: `HttpOnly, Secure, SameSite=Lax, __Host- prefix, ${SESSION_TTL_MS / 3_600_000} h, revocation re-checked every 60 s` });
  checks.push({ key: "CSRF", ok: deps.config.allowedOrigins.length > 0, detail: `Origin must be ${deps.config.allowedOrigins.join(", ") || "(not set)"}` });
  checks.push({ key: "Rate limit secret", ok: deps.config.rateLimitSecret.length >= 32, detail: deps.config.rateLimitSecret.length >= 32 ? "Set (>= 32 chars)" : "Too short" });
  try {
    const { projectId, token } = await serviceAccessToken();
    const res = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/config`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = (await res.json()) as {
      client?: { permissions?: { disabledUserSignup?: boolean; disabledUserDeletion?: boolean } };
      emailPrivacyConfig?: { enableImprovedEmailPrivacy?: boolean };
      passwordPolicyConfig?: { passwordPolicyEnforcementState?: string; passwordPolicyVersions?: { customStrengthOptions?: { minPasswordLength?: number } }[] };
      signIn?: { anonymous?: { enabled?: boolean }; phoneNumber?: { enabled?: boolean } };
    };
    checks.push({ key: "Self sign-up blocked (Firebase)", ok: cfg.client?.permissions?.disabledUserSignup === true, detail: "Only the admin can create accounts" });
    checks.push({ key: "Self account deletion blocked", ok: cfg.client?.permissions?.disabledUserDeletion === true, detail: "Accounts are managed by the admin" });
    checks.push({ key: "E-mail enumeration protection", ok: cfg.emailPrivacyConfig?.enableImprovedEmailPrivacy === true, detail: "Sign-in errors never reveal whether an address exists" });
    const min = cfg.passwordPolicyConfig?.passwordPolicyVersions?.[0]?.customStrengthOptions?.minPasswordLength ?? 6;
    checks.push({ key: "Password policy", ok: cfg.passwordPolicyConfig?.passwordPolicyEnforcementState === "ENFORCE" && min >= 12, detail: `Minimum length ${min}` });
    checks.push({ key: "Anonymous / phone sign-in off", ok: cfg.signIn?.anonymous?.enabled !== true && cfg.signIn?.phoneNumber?.enabled !== true, detail: "Only Google and e-mail + password" });
  } catch (e) {
    checks.push({ key: "Firebase Auth configuration", ok: false, detail: `Could not read (${e instanceof Error ? e.message : "error"})` });
  }
  return { checks };
}
