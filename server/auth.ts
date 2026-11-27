import { createHash } from "node:crypto";
import { adminAuth, type DecodedIdToken } from "./firebase";
import { REVOCATION_CHECK_MS } from "./config";

export type Role = "user" | "admin";

export interface SessionIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  signInProvider: string | null;
  /** Seconds since epoch when the user last entered credentials. */
  authTimeSec: number;
}

/** Narrow auth surface the rest of the server uses (makes tests possible without Firebase). */
export interface AuthProvider {
  /** null = authentication failure (expired, revoked, disabled, malformed). Infrastructure errors are thrown. */
  verifyIdToken(idToken: string): Promise<SessionIdentity | null>;
  createSessionCookie(idToken: string, ttlMs: number): Promise<string>;
  verifySession(cookie: string): Promise<SessionIdentity | null>;
  revokeAllSessions(uid: string): Promise<void>;
}

const MAX_CACHED = 5_000;

/**
 * Firebase Admin implementation. The cookie's signature, issuer and expiry are verified on EVERY request (locally,
 * with Google's cached public keys). Revocation and the disabled flag are re-checked with Firebase at most once per
 * REVOCATION_CHECK_MS per session per instance, so a disabled account is refused within 60 s.
 */
export class FirebaseAuthProvider implements AuthProvider {
  /** sha256(cookie) -> last revocation check. Raw cookies are never stored. */
  private readonly checked = new Map<string, { at: number; uid: string }>();

  constructor(private readonly now: () => number = Date.now) {}

  async verifyIdToken(idToken: string): Promise<SessionIdentity | null> {
    try {
      return toIdentity(await adminAuth().verifyIdToken(idToken, true));
    } catch (e) {
      return nullOnAuthError(e);
    }
  }

  createSessionCookie(idToken: string, ttlMs: number): Promise<string> {
    return adminAuth().createSessionCookie(idToken, { expiresIn: ttlMs });
  }

  async verifySession(cookie: string): Promise<SessionIdentity | null> {
    const key = createHash("sha256").update(cookie).digest("base64url");
    const t = this.now();
    const prev = this.checked.get(key);
    const checkRevoked = !prev || t - prev.at >= REVOCATION_CHECK_MS;
    try {
      const d = await adminAuth().verifySessionCookie(cookie, checkRevoked);
      if (checkRevoked) {
        if (this.checked.size >= MAX_CACHED) this.checked.clear();
        this.checked.set(key, { at: t, uid: d.uid });
      }
      return toIdentity(d);
    } catch (e) {
      this.checked.delete(key);
      return nullOnAuthError(e);
    }
  }

  async revokeAllSessions(uid: string): Promise<void> {
    await adminAuth().revokeRefreshTokens(uid);
    for (const [k, v] of this.checked) if (v.uid === uid) this.checked.delete(k);
  }
}

function toIdentity(d: DecodedIdToken): SessionIdentity {
  return {
    uid: d.uid,
    email: typeof d.email === "string" ? d.email.toLowerCase() : "",
    emailVerified: d.email_verified === true,
    role: d["role"] === "admin" ? "admin" : "user",
    signInProvider: typeof d.firebase?.sign_in_provider === "string" ? d.firebase.sign_in_provider : null,
    authTimeSec: typeof d.auth_time === "number" ? d.auth_time : 0,
  };
}

const AUTH_FAILURES = new Set([
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/argument-error",
  "auth/invalid-id-token",
  "auth/invalid-session-cookie",
]);

export function authErrorCode(e: unknown): string | undefined {
  const c = (e as { code?: unknown })?.code;
  return typeof c === "string" ? c : undefined;
}

function nullOnAuthError(e: unknown): null {
  const code = authErrorCode(e);
  if (code && AUTH_FAILURES.has(code)) return null;
  throw e;
}
