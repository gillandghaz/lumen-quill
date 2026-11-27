"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/client/lib/api";
import { LIMITS } from "@/shared/limits";
import { Avatar } from "../../Avatar";
import { ConfirmDialog } from "../../Modal";
import { Pagination } from "../../Pagination";
import { when } from "./AdminTab";

interface AdminUser { uid: string; email: string; username: string; role: "admin" | "user"; disabled: boolean; createdAt: number; lastLoginAt: number | null; notes: number; providers: string[]; avatarVersion: number | null }
type Pending = { kind: "disable" | "enable" | "signout" | "delete"; user: AdminUser } | null;
const PAGE = 10;

export function Accounts({ selfUid }: { selfUid: string }) {
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [page, setPage] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [typed, setTyped] = useState("");

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: AdminUser[] }>("/api/admin/users")).items);
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
      setPending(null);
      setTyped("");
    }
  }

  const all = items ?? [];
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const shown = all.slice(page * PAGE, page * PAGE + PAGE);
  const p = pending;

  return (
    <div className="stack">
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}
      <section className="panel">
        <div className="panel-head"><h2>Accounts</h2><span className="muted">{items ? `${all.length} total` : "…"}</span></div>
        <div className={`table-wrap${shown.length > 5 ? " scroll-5" : ""}`}>
          <table className="table">
            <thead><tr><th>User</th><th>Sign-in</th><th>Notes</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.uid}>
                  <td>
                    <div className="user-cell">
                      <Avatar uid={u.uid} version={u.avatarVersion} name={u.username} size={34} />
                      <div className="trunc"><strong>{u.username}</strong> {u.role === "admin" && <span className="badge">admin</span>}<br /><span className="muted small">{u.email}</span></div>
                    </div>
                  </td>
                  <td className="mono small">{u.providers.map((x) => (x === "google.com" ? "Google" : x === "password" ? "Password" : x)).join(", ") || "-"}</td>
                  <td>{u.notes}</td>
                  <td className="muted small">{when(u.lastLoginAt)}</td>
                  <td>{u.disabled ? <span className="badge badge-off">disabled</span> : <span className="badge">active</span>}</td>
                  <td>
                    {u.uid !== selfUid && u.role !== "admin" && (
                      <div className="btn-row nowrap" style={{ justifyContent: "flex-end" }}>
                        <button className="btn btn-sm btn-ghost" type="button" disabled={busy} onClick={() => setPending({ kind: u.disabled ? "enable" : "disable", user: u })}>{u.disabled ? "Enable" : "Disable"}</button>
                        <button className="btn btn-sm btn-ghost" type="button" disabled={busy} onClick={() => setPending({ kind: "signout", user: u })}>Sign out</button>
                        <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={() => setPending({ kind: "delete", user: u })}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page + 1} pages={pages} canPrev={page > 0} canNext={page + 1 < pages} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Create account</h2></div>
        <p className="muted">There is no public sign-up: accounts exist only when created here. Leave the password empty for a Google-only account (the e-mail must be that Google account).</p>
        <form onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api("/api/admin/users", { method: "POST", body: { email: form.email, username: form.username, ...(form.password ? { password: form.password } : {}) } });
            setForm({ email: "", username: "", password: "" });
          }, "Account created.");
        }}>
          <div className="grid-fields grid-3">
            <div className="field"><label className="label" htmlFor="ne">E-mail</label><input id="ne" className="input" type="email" required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label className="label" htmlFor="nu">Username</label><input id="nu" className="input" required minLength={LIMITS.usernameMin} maxLength={LIMITS.usernameMax} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} /></div>
            <div className="field"><label className="label" htmlFor="np">Initial password (optional)</label><input id="np" className="input" type="password" autoComplete="new-password" minLength={LIMITS.passwordMin} maxLength={LIMITS.passwordMax} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          <p className="hint">Usernames are unique. Passwords need at least {LIMITS.passwordMin} characters; share them privately.</p>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy && <span className="spinner" aria-hidden="true" />}Create account</button>
        </form>
      </section>

      <ConfirmDialog
        open={p !== null}
        busy={busy}
        danger={p?.kind !== "enable"}
        title={p ? { disable: `Disable ${p.user.username}?`, enable: `Enable ${p.user.username}?`, signout: `Sign out ${p.user.username}?`, delete: `Delete ${p.user.username}?` }[p.kind] : ""}
        confirmLabel={p ? { disable: "Disable", enable: "Enable", signout: "Sign out everywhere", delete: "Delete permanently" }[p.kind] : ""}
        onCancel={() => { setPending(null); setTyped(""); }}
        onConfirm={() => {
          if (!p) return;
          const u = p.user;
          if (p.kind === "delete") {
            if (typed !== "DELETE") return;
            void run(() => api(`/api/admin/users/${u.uid}`, { method: "DELETE", body: { confirm: typed } }), "Account deleted.");
          } else if (p.kind === "signout") {
            void run(() => api(`/api/admin/users/${u.uid}/revoke`, { method: "POST", body: {} }), "Signed out everywhere.");
          } else {
            void run(() => api(`/api/admin/users/${u.uid}`, { method: "PATCH", body: { disabled: p.kind === "disable" } }), p.kind === "disable" ? "Account disabled." : "Account enabled.");
          }
        }}
      >
        {p?.kind === "disable" && <>The account is signed out everywhere within a minute and cannot sign in until enabled again. Notes are kept.</>}
        {p?.kind === "enable" && <>The account can sign in again.</>}
        {p?.kind === "signout" && <>Every session of this account ends; they can sign in again.</>}
        {p?.kind === "delete" && (
          <>
            The account and ALL of its notes are removed permanently. Type <strong>DELETE</strong> to confirm.
            <input className="input" style={{ marginTop: "0.75rem" }} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" autoComplete="off" aria-label="Type DELETE to confirm" />
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
