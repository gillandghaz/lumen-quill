import { HttpError } from "../errors";
import { SENSITIVE_ACTION_SEC } from "../config";
import { adminAuth } from "../firebase";
import { authErrorCode } from "../auth";
import { changeUsername, updateSettings } from "../services/profile";
import { writeAudit } from "../services/audit";
import { avatarSchema, passwordCreateSchema, profileSchema, settingsSchema } from "@/shared/schemas";
import { getAvatar, removeAvatar, setAvatar } from "../services/avatar";
import { requireUser } from "../session";
import { json } from "./respond";
import { sessionClearCookie } from "./cookies";
import { body, safe, validUid, writer, type Handler } from "./kit";

export const updateSettingsH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps);
  const patch = settingsSchema.parse(await body(req, 1024));
  return json(200, { settings: await updateSettings(deps.db, u.identity.uid, patch) });
});

export const updateUsernameH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps, "account");
  const { username } = profileSchema.parse(await body(req, 512));
  const saved = await changeUsername(deps.db, u.identity.uid, username, deps.now());
  await writeAudit(deps.db, { action: "account.username", actorUid: u.identity.uid }, deps.now());
  return json(200, { username: saved });
});

/** Which sign-in methods the account has (drives "send reset link" vs "create a password"). */
export const passwordStatusH: Handler = safe(async (req, deps) => {
  const u = await requireUser(req, deps);
  const rec = await adminAuth().getUser(u.identity.uid);
  return json(200, { hasPassword: rec.providerData.some((p) => p.providerId === "password"), email: u.identity.email });
});

/**
 * CREATE a password for an account that has none (e.g. Google-only). Changing an existing password is NOT offered:
 * that goes through the e-mailed reset link only. Requires a sign-in within the last 10 minutes; afterwards every
 * session is revoked and the user signs in again.
 */
export const createPasswordH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps, "account");
  const { password } = passwordCreateSchema.parse(await body(req, 1024));
  if (deps.now() / 1000 - u.identity.authTimeSec > SENSITIVE_ACTION_SEC) throw new HttpError(401, "recent_login_required");
  const rec = await adminAuth().getUser(u.identity.uid);
  if (rec.providerData.some((p) => p.providerId === "password")) throw new HttpError(409, "password_exists");
  try {
    await adminAuth().updateUser(u.identity.uid, { password });
  } catch (e) {
    const code = authErrorCode(e);
    if (code === "auth/invalid-password" || code === "auth/password-does-not-meet-requirements") throw new HttpError(400, "weak_password");
    throw e;
  }
  await deps.auth.revokeAllSessions(u.identity.uid);
  await writeAudit(deps.db, { action: "account.password", actorUid: u.identity.uid }, deps.now());
  return json(200, { ok: true }, { "Set-Cookie": sessionClearCookie(deps.config.production) });
});

export const putAvatarH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps, "account");
  const { image } = avatarSchema.parse(await body(req, 130_000));
  return json(200, { version: await setAvatar(deps, u.identity.uid, image) });
});

export const deleteAvatarH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps, "account");
  await removeAvatar(deps, u.identity.uid);
  return json(200, { ok: true });
});

/** Profile photo bytes: own photo, or any for the admin. Strict headers: it can never be rendered as a document. */
export const getAvatarH: Handler = safe(async (req, deps, p) => {
  const u = await requireUser(req, deps);
  const uid = p["uid"] === "me" ? u.identity.uid : validUid(p["uid"]);
  const a = await getAvatar(deps, u, uid);
  if (!a) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const etag = `"${a.updatedAt}"`;
  const headers = {
    "Content-Type": "image/jpeg",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, max-age=86400",
    ETag: etag,
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(a.bytes), { status: 200, headers });
});
