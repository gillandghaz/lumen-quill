/** Server configuration. Fails closed in production when something required is missing. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h (Firebase maximum: 14 days)
/** The ID token exchanged for a session must come from a sign-in at most this old. */
export const RECENT_SIGNIN_SEC = 5 * 60;
/** Sensitive account actions (set password) need a sign-in at most this old. */
export const SENSITIVE_ACTION_SEC = 10 * 60;
/** How often a session's revocation / disabled status is re-checked with Firebase (signature is checked every request). */
export const REVOCATION_CHECK_MS = 60_000;
export const USERNAME_CHANGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const RATE_LIMIT_GRACE_MS = 24 * 60 * 60 * 1000;

export const COLLECTIONS = {
  users: "users",
  usernames: "usernames",
  notes: "notes",
  entries: "entries",
  audit: "auditLogs",
  rateLimits: "rateLimits",
} as const;

export interface AppConfig {
  production: boolean;
  allowedOrigins: string[];
  rateLimitSecret: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === "production";
  const origins = (env.APP_ORIGIN ?? (production ? "" : "http://localhost:3000"))
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const secret = env.RATE_LIMIT_SECRET ?? (production ? "" : "dev-only-rate-limit-secret-0123456789");
  if (production && (origins.length === 0 || secret.length < 32)) {
    throw new Error("APP_ORIGIN and RATE_LIMIT_SECRET (>= 32 chars) are required in production (not configured)");
  }
  return { production, allowedOrigins: origins, rateLimitSecret: secret };
}

export function sessionCookieName(production: boolean): string {
  // __Host- prefix: Secure, Path=/, no Domain; the browser refuses it from any other origin or over HTTP.
  return production ? "__Host-la_session" : "la_session";
}
