"use client";

import { useCallback, useEffect, useState } from "react";
import type { PageUser } from "@/server/page-guards";
import { api, downloadBlob, errorText } from "@/client/lib/api";
import { LIMITS } from "@/shared/limits";
import { shortDayLabel } from "@/shared/day";

type Tab = "accounts" | "stats" | "security" | "backup";
const TABS: { id: Tab; label: string }[] = [
  { id: "accounts", label: "Accounts" },
  { id: "stats", label: "Statistics" },
  { id: "security", label: "Security" },
  { id: "backup", label: "Backup" },
];

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never");

export function AdminPanel({ user }: { user: PageUser }) {
  const [tab, setTab] = useState<Tab>("accounts");
  return (
    <>
      <div className="page-head">
        <div>
          <p className="label glyph">Administrator · {user.username}</p>
          <h1>Admin dashboard</h1>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === "accounts" && <Accounts selfUid={user.uid} />}
      {tab === "stats" && <Stats />}
      {tab === "security" && <Security />}
      {tab === "backup" && <Backup />}
    </>
  );
}

interface AdminUser { uid: string; email: string; username: string; role: "admin" | "user"; disabled: boolean; createdAt: number; lastLoginAt: number | null; notes: number; providers: string[] }

function Accounts({ selfUid }: { selfUid: string }) {
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: AdminUser[] }>("/api/admin/users")).items);
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}
      <section className="panel">
        <div className="panel-head"><h2>Accounts</h2><span className="muted">{items?.length ?? "…"} total</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>User</th><th>Sign-in</th><th>Notes</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
            <tbody>
              {(items ?? []).map((u) => (
                <tr key={u.uid}>
                  <td><strong>{u.username}</strong> {u.role === "admin" && <span className="badge">admin</span>}<br /><span className="muted">{u.email}</span></td>
                  <td className="mono">{u.providers.map((p) => (p === "google.com" ? "Google" : p === "password" ? "Password" : p)).join(", ") || "-"}</td>
                  <td>{u.notes}</td>
                  <td className="muted">{when(u.lastLoginAt)}</td>
                  <td>{u.disabled ? <span className="badge badge-off">disabled</span> : <span className="badge">active</span>}</td>
                  <td>
                    {u.uid !== selfUid && u.role !== "admin" && (
                      <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                        <button className="btn btn-sm btn-ghost" type="button" disabled={busy} onClick={() => void act(() => api(`/api/admin/users/${u.uid}`, { method: "PATCH", body: { disabled: !u.disabled } }), u.disabled ? "Account enabled." : "Account disabled.")}>{u.disabled ? "Enable" : "Disable"}</button>
                        <button className="btn btn-sm btn-ghost" type="button" disabled={busy} onClick={() => void act(() => api(`/api/admin/users/${u.uid}/revoke`, { method: "POST", body: {} }), "Signed out everywhere.")}>Sign out</button>
                        <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={() => {
                          const c = window.prompt(`Delete ${u.username} and ALL of their notes permanently? Type DELETE to confirm.`);
                          if (c === "DELETE") void act(() => api(`/api/admin/users/${u.uid}`, { method: "DELETE", body: { confirm: c } }), "Account deleted.");
                        }}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Create account</h2></div>
        <p className="muted">There is no public sign-up: accounts exist only when created here. Leave the password empty for a Google-only account (the e-mail must be that Google account).</p>
        <form onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            await api("/api/admin/users", { method: "POST", body: { email: form.email, username: form.username, ...(form.password ? { password: form.password } : {}) } });
            setForm({ email: "", username: "", password: "" });
          }, "Account created.");
        }}>
          <div className="grid-2">
            <div className="field"><label className="label" htmlFor="ne">E-mail</label><input id="ne" className="input" type="email" required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label className="label" htmlFor="nu">Username</label><input id="nu" className="input" required minLength={LIMITS.usernameMin} maxLength={LIMITS.usernameMax} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} /></div>
            <div className="field"><label className="label" htmlFor="np">Initial password (optional)</label><input id="np" className="input" type="password" autoComplete="new-password" minLength={LIMITS.passwordMin} maxLength={LIMITS.passwordMax} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><span className="hint">At least {LIMITS.passwordMin} characters. Share it privately.</span></div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>Create account</button>
        </form>
      </section>
    </div>
  );
}

interface StatsData { users: number; notes: number; entries: number; words: number; activity: { day: string; entries: number; words: number }[] }

function Stats() {
  const [d, setD] = useState<StatsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<StatsData>("/api/admin/stats").then(setD).catch((e) => setErr(errorText(e))); }, []);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="muted mono">Loading…</p>;
  const max = Math.max(1, ...d.activity.map((a) => a.words));
  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><p className="label">Accounts</p><p className="value">{d.users}</p></div>
        <div className="stat"><p className="label">Notes</p><p className="value">{d.notes}</p></div>
        <div className="stat"><p className="label">Dated entries</p><p className="value">{d.entries}</p></div>
        <div className="stat"><p className="label">Words</p><p className="value">{d.words.toLocaleString("en")}</p></div>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Last 30 days</h2><span className="muted">words per day (entries edited in the period)</span></div>
        {d.activity.length === 0 ? <p className="muted">No writing in the last 30 days.</p> : (
          <>
            <div className="bars" role="img" aria-label="Words written per day over the last 30 days">
              {d.activity.map((a) => <div key={a.day} className="bar" style={{ height: `${Math.max(3, (a.words / max) * 100)}%` }} title={`${shortDayLabel(a.day)}: ${a.words} words, ${a.entries} entries`} />)}
            </div>
            <p className="mono faint" style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}><span>{shortDayLabel(d.activity[0]!.day)}</span><span>{shortDayLabel(d.activity[d.activity.length - 1]!.day)}</span></p>
          </>
        )}
      </section>
    </div>
  );
}

interface AuditItem { id: string; action: string; actorUid: string | null; targetUid: string | null; at: number; details: Record<string, unknown> }

function Security() {
  const [checks, setChecks] = useState<{ key: string; ok: boolean; detail: string }[] | null>(null);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadAudit = useCallback(async (c?: string) => {
    const r = await api<{ items: AuditItem[]; nextCursor: string | null }>(`/api/admin/audit${c ? `?cursor=${c}` : ""}`);
    setAudit((prev) => (c ? [...prev, ...r.items] : r.items));
    setCursor(r.nextCursor);
  }, []);

  useEffect(() => {
    api<{ checks: typeof checks }>("/api/admin/security").then((r) => setChecks(r.checks)).catch((e) => setMsg({ ok: false, text: errorText(e) }));
    loadAudit().catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, [loadAudit]);

  return (
    <div className="stack">
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}
      <section className="panel">
        <div className="panel-head"><h2>Security posture</h2></div>
        {!checks ? <p className="muted mono">Checking…</p> : checks.map((c) => (
          <div key={c.key} className="check"><span className="dot" data-ok={String(c.ok)} aria-label={c.ok ? "OK" : "Attention"} /><strong>{c.key}</strong><span /><span className="muted">{c.detail}</span></div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Emergency</h2></div>
        <p className="muted">Sign every other account out of all devices immediately.</p>
        <button className="btn btn-danger" type="button" onClick={async () => {
          const c = window.prompt("Type SIGN OUT ALL to confirm.");
          if (c !== "SIGN OUT ALL") return;
          try {
            const r = await api<{ accounts: number }>("/api/admin/revoke-all", { method: "POST", body: { confirm: c } });
            setMsg({ ok: true, text: `Signed out ${r.accounts} accounts.` });
          } catch (e) {
            setMsg({ ok: false, text: errorText(e) });
          }
        }}>Sign out all accounts</button>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Audit log</h2><span className="muted">kept 180 days · ids and codes only</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{when(a.at)}</td>
                  <td className="mono">{a.action}</td>
                  <td className="mono faint">{a.actorUid ? a.actorUid.slice(0, 8) : "-"}</td>
                  <td className="mono faint">{a.targetUid ? a.targetUid.slice(0, 8) : "-"}</td>
                  <td className="mono faint">{Object.entries(a.details).map(([k, v]) => `${k}=${String(v)}`).join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cursor && <button className="btn btn-ghost" type="button" onClick={() => void loadAudit(cursor)}>Load more</button>}
      </section>
    </div>
  );
}

function Backup() {
  const [state, setState] = useState<{ busy: boolean; text: string | null; ok: boolean }>({ busy: false, text: null, ok: true });
  async function run() {
    setState({ busy: true, text: "Collecting…", ok: true });
    try {
      const users: unknown[] = [];
      const notes: unknown[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 400; page++) {
        const r: { users?: unknown[]; notes: unknown[]; nextCursor: string | null } = await api(`/api/admin/backup${cursor ? `?cursor=${cursor}` : ""}`);
        if (r.users) users.push(...r.users);
        notes.push(...r.notes);
        setState({ busy: true, text: `Collected ${notes.length} notes…`, ok: true });
        cursor = r.nextCursor;
        if (!cursor) break;
      }
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadBlob(JSON.stringify({ format: "lumine-archive-backup", version: 1, exportedAt: new Date().toISOString(), users, notes }, null, 2), `lumine-archive-backup-${stamp}.json`, "application/json");
      setState({ busy: false, text: `Backup ready: ${users.length} accounts, ${notes.length} notes.`, ok: true });
    } catch (e) {
      setState({ busy: false, text: errorText(e), ok: false });
    }
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2>Full backup</h2></div>
      <p className="muted">Downloads every account profile and every note with all dated entries as one JSON file. It contains private writing: store it encrypted and never share it.</p>
      {state.text && <p className={state.ok ? "success" : "error"} role="status">{state.text}</p>}
      <button className="btn btn-primary" type="button" disabled={state.busy} onClick={() => void run()}>Download backup</button>
    </section>
  );
}
