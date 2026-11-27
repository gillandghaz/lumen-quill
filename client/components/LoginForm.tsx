"use client";

import { useState } from "react";
import Link from "next/link";
import { loginWithEmail, loginWithGoogle, type AuthResult } from "@/client/auth/actions";

const TEXT: Record<Exclude<AuthResult, { ok: true }>["code"], string> = {
  credentials: "Those details did not work. Check them and try again.",
  not_allowed: "This account cannot sign in here. Ask the archive keeper for access.",
  rate_limited: "Too many attempts. Please wait a few minutes.",
  network: "Network problem. Check your connection and try again.",
  popup: "The Google window was closed or blocked. Allow pop-ups and try again.",
  generic: "Sign-in failed. Please try again.",
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(p: Promise<AuthResult>) {
    setBusy(true);
    setError(null);
    const r = await p;
    if (r.ok) {
      window.location.replace("/archive");
      return;
    }
    setError(TEXT[r.code]);
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="btn btn-block" disabled={busy} onClick={() => void finish(loginWithGoogle())}>
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Continue with Google
      </button>
      <div className="divider-text">or</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void finish(loginWithEmail(email, password));
        }}
      >
        <div className="field">
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="hint" style={{ marginTop: "0.75rem" }}><Link href="/forgot-password">Forgot password?</Link></p>
    </>
  );
}
