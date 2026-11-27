import { z } from "zod";
import { HttpError } from "../errors";
import { SENSITIVE_ACTION_SEC } from "../config";
import { adminAuth } from "../firebase";
import { authErrorCode } from "../auth";
import { changeUsername, updateSettings } from "../services/profile";
import { writeAudit } from "../services/audit";
import { profileSchema, settingsSchema } from "@/shared/schemas";
import { LIMITS } from "@/shared/limits";
import { json } from "./respond";
import { sessionClearCookie } from "./cookies";
import { body, safe, writer, type Handler } from "./kit";

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

const passwordSchema = z.object({ password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax) }).strict();

/**
 * Set or change the password (also lets a Google-only account add password sign-in).
 * Requires a sign-in within the last 10 minutes; afterwards every session is revoked and the user signs in again.
 */
export const setPasswordH: Handler = safe(async (req, deps) => {
  const u = await writer(req, deps, "account");
  const { password } = passwordSchema.parse(await body(req, 1024));
  if (deps.now() / 1000 - u.identity.authTimeSec > SENSITIVE_ACTION_SEC) throw new HttpError(401, "recent_login_required");
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
