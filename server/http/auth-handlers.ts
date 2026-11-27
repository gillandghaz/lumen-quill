import { HttpError } from "../errors";
import { COLLECTIONS, RECENT_SIGNIN_SEC, SESSION_TTL_MS } from "../config";
import { adminAuth } from "../firebase";
import { assertSameOrigin } from "../security/csrf";
import { clientIp } from "../security/client-ip";
import { RULES } from "../security/rate-limit";
import { currentUserFromRequest, requireUser, isAdmin } from "../session";
import { getProfile, updateSettings } from "../services/profile";
import { writeAudit } from "../services/audit";
import { sessionSchema } from "@/shared/schemas";
import { json } from "./respond";
import { sessionClearCookie, sessionSetCookie } from "./cookies";
import { body, safe, type Handler } from "./kit";

/** A Firebase account that signed itself up (e.g. a stranger's Google popup) and has no profile is removed again. */
const ORPHAN_WINDOW_MS = 10 * 60_000;

/**
 * Exchange a fresh Firebase ID token for an HttpOnly session cookie. There is NO sign-up: only accounts that the
 * admin created (= have a profile) get a session. Every refusal is the same generic "not_allowed" to the client.
 */
export const createSession: Handler = safe(async (req, deps) => {
  assertSameOrigin(req, deps.config.allowedOrigins);
  await deps.limiter.hit("session", clientIp(req), RULES.session);
  const { idToken, timeZone } = sessionSchema.parse(await body(req, 8192));

  const token = await deps.auth.verifyIdToken(idToken);
  if (!token) throw new HttpError(401, "unauthorized");
  if (!token.emailVerified) throw new HttpError(403, "email_not_verified");
  if (deps.now() / 1000 - token.authTimeSec > RECENT_SIGNIN_SEC) throw new HttpError(401, "recent_login_required");

  const profile = await getProfile(deps.db, token.uid);
  if (!profile) {
    // Not an account the admin created. If Firebase created it moments ago (self sign-up slipped through), delete it.
    try {
      const rec = await adminAuth().getUser(token.uid);
      const created = Date.parse(rec.metadata.creationTime);
      if (Number.isFinite(created) && deps.now() - created < ORPHAN_WINDOW_MS) await adminAuth().deleteUser(token.uid);
    } catch {
      /* best effort */
    }
    await writeAudit(deps.db, { action: "auth.denied", actorUid: null, details: { reason: "no_profile" } }, deps.now());
    throw new HttpError(403, "not_allowed");
  }
  if (profile.disabled) {
    await writeAudit(deps.db, { action: "auth.denied", actorUid: token.uid, details: { reason: "disabled" } }, deps.now());
    throw new HttpError(403, "not_allowed");
  }
  // The account e-mail cannot be changed through the app. A different Firebase e-mail means someone changed it
  // elsewhere (e.g. with a leaked password): refuse and record it for the admin.
  if (profile.email && token.email && profile.email.toLowerCase() !== token.email.toLowerCase()) {
    await writeAudit(deps.db, { action: "auth.denied", actorUid: token.uid, details: { reason: "email_changed" } }, deps.now());
    throw new HttpError(403, "not_allowed");
  }
  // Admin needs the custom claim AND the profile role; a mismatch is refused rather than silently downgraded.
  if ((token.role === "admin") !== (profile.role === "admin")) {
    await writeAudit(deps.db, { action: "auth.denied", actorUid: token.uid, details: { reason: "role_mismatch" } }, deps.now());
    throw new HttpError(403, "not_allowed");
  }

  const cookie = await deps.auth.createSessionCookie(idToken, SESSION_TTL_MS);
  await deps.db.collection(COLLECTIONS.users).doc(token.uid).update({ lastLoginAt: deps.now() });
  // First sign-in: adopt the browser's time zone so "today" matches the writer's calendar.
  if (timeZone && profile.lastLoginAt === null) await updateSettings(deps.db, token.uid, { timeZone });
  await writeAudit(deps.db, { action: "auth.login", actorUid: token.uid, details: { provider: token.signInProvider ?? "unknown" } }, deps.now());
  return json(200, { ok: true, mode: profile.settings.mode }, { "Set-Cookie": sessionSetCookie(deps.config.production, cookie) });
});

export const logout: Handler = safe(async (req, deps) => {
  assertSameOrigin(req, deps.config.allowedOrigins);
  return json(200, { ok: true }, { "Set-Cookie": sessionClearCookie(deps.config.production) });
});

export const logoutAll: Handler = safe(async (req, deps) => {
  assertSameOrigin(req, deps.config.allowedOrigins);
  const u = await requireUser(req, deps);
  await deps.auth.revokeAllSessions(u.identity.uid);
  await writeAudit(deps.db, { action: "auth.logout_all", actorUid: u.identity.uid }, deps.now());
  return json(200, { ok: true }, { "Set-Cookie": sessionClearCookie(deps.config.production) });
});

/** Polled by the client. 401 = no longer signed in (the client signs out). 5xx = temporary: the client stays. */
export const me: Handler = safe(async (req, deps) => {
  const u = await currentUserFromRequest(req, deps);
  if (!u) return json(401, { error: "unauthorized" }, { "Set-Cookie": sessionClearCookie(deps.config.production) });
  return json(200, {
    uid: u.identity.uid,
    email: u.identity.email,
    username: u.profile.username,
    admin: isAdmin(u),
    provider: u.identity.signInProvider,
    settings: u.profile.settings,
  });
});
