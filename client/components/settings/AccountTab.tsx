"use client";

import { useEffect, useRef, useState } from "react";
import type { PageUser } from "@/server/page-guards";
import { api, ApiError, errorText } from "@/client/lib/api";
import { fileToAvatar } from "@/client/lib/avatar";
import { logoutEverywhere, requestPasswordReset } from "@/client/auth/actions";
import { LIMITS } from "@/shared/limits";
import { Avatar } from "../Avatar";
import { ConfirmDialog } from "../Modal";

const PROVIDER: Record<string, string> = { "google.com": "Google", password: "E-mail + password" };
type Msg = { ok: boolean; text: string } | null;

export function AccountTab({ user }: { user: PageUser }) {
  return (
    <div className="stack">
      <PhotoSection user={user} />
      <ProfileSection user={user} />
      <PasswordSection />
      <SessionsSection />
    </div>
  );
}

function PhotoSection({ user }: { user: PageUser }) {
  const [version, setVersion] = useState(user.avatarVersion);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function announce(v: number | null) {
    setVersion(v);
    window.dispatchEvent(new CustomEvent("lq:avatar", { detail: v }));
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const image = await fileToAvatar(file);
      const r = await api<{ version: number }>("/api/account/avatar", { method: "PUT", body: { image } });
      announce(r.version);
      setMsg({ ok: true, text: "Photo updated." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? errorText(e) : (e as Error).message });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="panel">
      <div className="photo-row">
        <Avatar uid={user.uid} version={version} name={user.username} size={72} />
        <div className="photo-text">
          <h2>Profile photo</h2>
          <p className="muted">A square photo works best. Without one, you get the Lumen Quill emblem.</p>
          <div className="btn-row">
            <input ref={input} id="photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void upload(e.target.files?.[0])} />
            <label htmlFor="photo" className="btn btn-sm" aria-disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Uploading…</> : version ? "Change photo" : "Upload photo"}</label>
            {version && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setConfirm(true)}>Remove</button>}
          </div>
          {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}
        </div>
      </div>
      <ConfirmDialog open={confirm} title="Remove profile photo?" confirmLabel="Remove" danger busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api("/api/account/avatar", { method: "DELETE" });
            announce(null);
            setMsg({ ok: true, text: "Photo removed." });
          } catch (e) {
            setMsg({ ok: false, text: errorText(e) });
          } finally {
            setBusy(false);
            setConfirm(false);
          }
        }}>
        Your profile will show the default Lumen Quill emblem.
      </ConfirmDialog>
    </section>
  );
}

function ProfileSection({ user }: { user: PageUser }) {
  const [saved, setSaved] = useState(user.username);
  const [username, setUsername] = useState(user.username);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^[a-z0-9](?:[a-z0-9_.]*[a-z0-9])?$/.test(username) && username.length >= LIMITS.usernameMin && username.length <= LIMITS.usernameMax;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Profile</h2></div>
      <div className="kv">
        <span className="label">E-mail</span><span>{user.email}</span>
        <span className="label">Signed in with</span><span>{PROVIDER[user.provider ?? ""] ?? user.provider ?? "Unknown"}</span>
      </div>
      <form className="inline-form" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ username: string }>("/api/account/username", { method: "PUT", body: { username } });
          setSaved(r.username);
          setUsername(r.username);
          setMsg({ ok: true, text: "Username saved." });
        } catch (err) {
          setMsg({ ok: false, text: errorText(err) });
        } finally {
          setBusy(false);
        }
      }}>
        <div className="field">
          <label className="label" htmlFor="username">Username</label>
          <input id="username" className="input" value={username} minLength={LIMITS.usernameMin} maxLength={LIMITS.usernameMax} onChange={(e) => { setUsername(e.target.value.toLowerCase()); setMsg(null); }} aria-invalid={!valid} />
        </div>
        <button className="btn" type="submit" disabled={busy || !valid || username === saved}>{busy && <span className="spinner" aria-hidden="true" />}Save</button>
      </form>
      <p className="hint">Unique across Lumen Quill: a name already in use is refused. 3–24 characters (a–z, 0–9, dot, underscore); changeable once every 7 days.</p>
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}
    </section>
  );
}

function PasswordSection() {
  const [state, setState] = useState<{ hasPassword: boolean; email: string } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  useEffect(() => {
    api<{ hasPassword: boolean; email: string }>("/api/account/password").then(setState).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, []);

  return (
    <section className="panel">
      <div className="panel-head"><h2>Password</h2></div>
      {!state ? <div className="skeleton" /> : state.hasPassword ? (
        <>
          <p className="muted">For your safety the password is never changed here. We e-mail a one-time link to <strong>{state.email}</strong>; open it to choose a new password.</p>
          <button className="btn" type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            await requestPasswordReset(state.email);
            setBusy(false);
            setMsg({ ok: true, text: "Reset link sent. Check your inbox (and spam)." });
          }}>{busy && <span className="spinner" aria-hidden="true" />}Send reset link</button>
        </>
      ) : (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (pw !== pw2) return setMsg({ ok: false, text: "The two passwords do not match." });
          setBusy(true);
          try {
            await api("/api/account/password", { method: "POST", body: { password: pw } });
            setMsg({ ok: true, text: "Password created. Signing you out of every device…" });
            setTimeout(() => window.location.replace("/login"), 1500);
          } catch (err) {
            setMsg({ ok: false, text: err instanceof ApiError && err.code === "recent_login_required" ? "For safety, sign out and sign in again, then create the password within 10 minutes." : errorText(err) });
            setBusy(false);
          }
        }}>
          <p className="muted">This account signs in with Google only. Create a password to also sign in with your e-mail.</p>
          <div className="grid-fields">
            <div className="field">
              <label className="label" htmlFor="pw">New password</label>
              <input id="pw" className="input" type="password" autoComplete="new-password" minLength={LIMITS.passwordMin} maxLength={LIMITS.passwordMax} required value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="pw2">Repeat password</label>
              <input id="pw2" className="input" type="password" autoComplete="new-password" minLength={LIMITS.passwordMin} maxLength={LIMITS.passwordMax} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
          </div>
          <p className="hint">At least {LIMITS.passwordMin} characters.</p>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy && <span className="spinner" aria-hidden="true" />}Create password</button>
        </form>
      )}
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}
    </section>
  );
}

function SessionsSection() {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel row-panel">
      <div>
        <h2>Sessions</h2>
        <p className="muted" style={{ margin: 0 }}>Sign out on every browser and device where this account is signed in.</p>
      </div>
      <button className="btn btn-danger" type="button" onClick={() => setConfirm(true)}>Sign out everywhere</button>
      <ConfirmDialog open={confirm} title="Sign out everywhere?" confirmLabel="Sign out everywhere" danger busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          await logoutEverywhere();
          window.location.replace("/login");
        }}>
        Every device, including this one, will need to sign in again.
      </ConfirmDialog>
    </section>
  );
}
