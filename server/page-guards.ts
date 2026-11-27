import { cache } from "react";
import { cookies } from "next/headers";
import { sessionCookieName } from "./config";
import type { UserSettings } from "./services/profile";

export interface PageUser {
  uid: string;
  email: string;
  username: string;
  admin: boolean;
  provider: string | null;
  settings: UserSettings;
}

export type PageContext = { configured: true; user: PageUser | null } | { configured: false };

/**
 * Session for server-rendered pages. NEVER throws: missing configuration or a datastore outage becomes
 * `configured: false` (the page shows "temporarily unavailable"), not a 500 with internals.
 * Wrapped in React `cache()`: layout + page share ONE verification per request (never across requests or users).
 */
export const loadPageContext = cache(async (): Promise<PageContext> => {
  // Cookies first: marks the page dynamic, and a visitor without a session cookie never touches Firebase.
  const jar = await cookies();
  const cookie = jar.get(sessionCookieName(process.env.NODE_ENV === "production"))?.value ?? null;
  if (!cookie) return { configured: true, user: null };
  try {
    const [{ getDeps }, { resolveCurrentUser, isAdmin }] = await Promise.all([import("./deps"), import("./session")]);
    const deps = getDeps();
    const u = await resolveCurrentUser(cookie, deps);
    return {
      configured: true,
      user: u
        ? { uid: u.identity.uid, email: u.identity.email, username: u.profile.username, admin: isAdmin(u), provider: u.identity.signInProvider, settings: u.profile.settings }
        : null,
    };
  } catch (e) {
    console.error("page_context_unavailable", e instanceof Error ? e.name : "unknown");
    return { configured: false };
  }
});
