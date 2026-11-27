import type { Deps } from "./deps";
import type { SessionIdentity } from "./auth";
import { HttpError } from "./errors";
import { sessionCookieName } from "./config";
import { readCookie } from "./http/cookies";
import { getProfile, type Profile } from "./services/profile";

export interface CurrentUser {
  identity: SessionIdentity;
  profile: Profile;
}

/**
 * A valid session = the cookie verifies (incl. revocation + Firebase "disabled"), an app profile exists
 * and that profile is not disabled. A Firebase account without a profile has no access to anything.
 */
export async function resolveCurrentUser(cookie: string | null, deps: Deps): Promise<CurrentUser | null> {
  if (!cookie) return null;
  const identity = await deps.auth.verifySession(cookie);
  if (!identity) return null;
  const profile = await getProfile(deps.db, identity.uid);
  if (!profile || profile.disabled) return null;
  return { identity, profile };
}

export function currentUserFromRequest(req: Request, deps: Deps): Promise<CurrentUser | null> {
  return resolveCurrentUser(readCookie(req, sessionCookieName(deps.config.production)), deps);
}

export async function requireUser(req: Request, deps: Deps): Promise<CurrentUser> {
  const u = await currentUserFromRequest(req, deps);
  if (!u) throw new HttpError(401, "unauthorized");
  return u;
}

export const isAdmin = (u: CurrentUser): boolean => u.identity.role === "admin" && u.profile.role === "admin";

/** Admin = verified custom claim AND the profile agrees (two independent sources; never from client input). */
export async function requireAdmin(req: Request, deps: Deps): Promise<CurrentUser> {
  const u = await requireUser(req, deps);
  if (!isAdmin(u)) throw new HttpError(403, "forbidden");
  return u;
}
