"use client";

import { useState } from "react";
import type { PageUser } from "@/server/page-guards";
import { api, ApiError, errorText } from "@/client/lib/api";
import { logoutEverywhere } from "@/client/auth/actions";
import { LIMITS } from "@/shared/limits";

const PROVIDER: Record<string, string> = { "google.com": "Google", password: "E-mail + password" };

export function AccountPanel({ user }: { user: PageUser }) {
  const [username, setUsername] = useState(user.username);
  const [uMsg, setUMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pMsg, setPMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ username: string }>("/api/account/username", { method: "PUT", body: { username } });
      setUsername(r.username);
      setUMsg({ ok: true, text: "Username saved." });
    } catch (err) {
      setUMsg({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setPMsg({ ok: false, text: "The two passwords do not match." });
    setBusy(true);
    try {
      await api("/api/account/password", { method: "POST", body: { password: pw } });
      setPMsg({ ok: true, text: "Password saved. Signing you out of every device…" });
      setTimeout(() => window.location.replace("/login"), 1500);
    } catch (err) {
      setPMsg({ ok: false, text: err instanceof ApiError && err.code === "recent_login_required" ? "For safety, sign out and sign in again, then set the password within 10 minutes." : errorText(err) });
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="label glyph">Account</p>
          <h1>{user.username}</h1>
        </div>
        {user.admin && <span className="badge">Administrator</span>}
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Profile</h2></div>
          <dl style={{ margin: "0 0 1rem" }}>
            <dt className="label">E-mail</dt>
            <dd style={{ margin: "0 0 0.75rem" }}>{user.email}</dd>
            <dt className="label">Signed in with</dt>
            <dd style={{ margin: 0 }}>{PROVIDER[user.provider ?? ""] ?? user.provider ?? "Unknown"}</dd>
          </dl>
          <form onSubmit={saveUsername}>
            <div className="field">
              <label className="label" htmlFor="username">Username</label>
              <input id="username" className="input" value={username} minLength={LIMITS.usernameMin} maxLength={LIMITS.usernameMax} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
              <span className="hint">3–24 characters: a–z, 0–9, dot, underscore. Can be changed once every 7 days.</span>
            </div>
            {uMsg && <p className={uMsg.ok ? "success" : "error"} role="status">{uMsg.text}</p>}
            <button className="btn" type="submit" disabled={busy || username === user.username}>Save username</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Password</h2></div>
          <p className="muted">Set a password to sign in with e-mail as well as Google, or change the current one. You will be signed out of every device afterwards.</p>
          <form onSubmit={savePassword}>
            <div className="field">
              <label className="label" htmlFor="pw">New password</label>
              <input id="pw" className="input" type="password" autoComplete="new-password" minLength={LIMITS.passwordMin} maxLength={LIMITS.passwordMax} required value={pw} onChange={(e) => setPw(e.target.value)} />
              <span className="hint">At least {LIMITS.passwordMin} characters.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="pw2">Repeat password</label>
              <input id="pw2" className="input" type="password" autoComplete="new-password" minLength={LIMITS.passwordMin} maxLength={LIMITS.passwordMax} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {pMsg && <p className={pMsg.ok ? "success" : "error"} role="status">{pMsg.text}</p>}
            <button className="btn" type="submit" disabled={busy}>Save password</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Sessions</h2></div>
          <p className="muted">Sign out on every browser and device where this account is signed in.</p>
          <button className="btn btn-danger" type="button" onClick={async () => {
            if (!window.confirm("Sign out of every device?")) return;
            await logoutEverywhere();
            window.location.replace("/login");
          }}>Sign out everywhere</button>
        </section>
      </div>
    </>
  );
}
