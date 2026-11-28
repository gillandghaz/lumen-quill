"use client";

import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "@firebase/auth";
import { clientAuth } from "./firebase-client";
import { clearLiveUser } from "@/client/lib/live-user";
import { MODE_COOKIE } from "@/shared/limits";

/** Result codes mapped to text by the UI. Messages are deliberately generic (no account enumeration). */
export type AuthResult =
  | { ok: true }
  | { ok: false; code: "credentials" | "not_allowed" | "rate_limited" | "network" | "popup" | "generic" };

async function post(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    credentials: "same-origin",
  });
}

/** Exchange the Firebase ID token for the server's HttpOnly session cookie, then drop the SDK's own sign-in. */
async function exchange(): Promise<AuthResult> {
  const auth = await clientAuth();
  const user = auth.currentUser;
  if (!user) return { ok: false, code: "generic" };
  let res: Response;
  try {
    const idToken = await user.getIdToken(true);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    res = await post("/api/auth/session", { idToken, timeZone });
  } catch {
    await signOut(auth).catch(() => undefined);
    return { ok: false, code: "network" };
  }
  await signOut(auth).catch(() => undefined);
  if (res.ok) {
    clearLiveUser();
    const mode = ((await res.json().catch(() => ({}))) as { mode?: string }).mode;
    if (mode === "sonata" || mode === "palace") {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${MODE_COOKIE}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    }
    return { ok: true };
  }
  if (res.status === 429) return { ok: false, code: "rate_limited" };
  if (res.status === 403) return { ok: false, code: "not_allowed" };
  return { ok: false, code: "generic" };
}

function mapError(e: unknown): AuthResult {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/network-request-failed") return { ok: false, code: "network" };
  if (code === "auth/too-many-requests") return { ok: false, code: "rate_limited" };
  if (code === "auth/popup-closed-by-user" || code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") return { ok: false, code: "popup" };
  // Self sign-up is blocked in Firebase: an unknown Google account ends here.
  if (code === "auth/admin-restricted-operation" || code === "auth/operation-not-allowed" || code === "auth/user-disabled") return { ok: false, code: "not_allowed" };
  return { ok: false, code: "credentials" };
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    await signInWithEmailAndPassword(await clientAuth(), email.trim(), password);
    return await exchange();
  } catch (e) {
    return mapError(e);
  }
}

export async function loginWithGoogle(): Promise<AuthResult> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(await clientAuth(), provider);
    return await exchange();
  } catch (e) {
    return mapError(e);
  }
}

/** Always "succeeds" from the user's point of view (no enumeration). */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    const auth = await clientAuth();
    try {
      await sendPasswordResetEmail(auth, email.trim(), { url: `${window.location.origin}/login` });
    } catch (e) {
      // Preview domains are not authorised as continue URLs: retry without one.
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri") await sendPasswordResetEmail(auth, email.trim());
    }
  } catch {
    /* deliberately ignored */
  }
}

export async function logout(): Promise<void> {
  clearLiveUser();
  await post("/api/auth/logout").catch(() => undefined);
}

export async function logoutEverywhere(): Promise<boolean> {
  clearLiveUser();
  const res = await post("/api/auth/logout-all").catch(() => null);
  return res?.ok === true;
}
