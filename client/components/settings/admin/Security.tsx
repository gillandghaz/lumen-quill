"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "@/client/lib/api";
import { ConfirmDialog } from "../../Modal";

interface Check { key: string; ok: boolean; detail: string }

export function Security() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ checks: Check[] }>("/api/admin/security").then((r) => setChecks(r.checks)).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, []);
  const failing = checks?.filter((c) => !c.ok).length ?? 0;
  return (
    <div className="stack">
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}
      <section className="panel">
        <div className="panel-head">
          <h2>Security posture</h2>
          {checks && <span className={failing ? "badge badge-off" : "badge"}>{failing ? `${failing} need attention` : "all good"}</span>}
        </div>
        {!checks ? <div className="skeleton tall" /> : (
          <div className={checks.length > 8 ? "scroll-8" : undefined}>
            {checks.map((c) => (
              <div key={c.key} className="check">
                <span className="dot" data-ok={String(c.ok)} aria-label={c.ok ? "OK" : "Attention"} />
                <div><strong>{c.key}</strong><br /><span className="muted small">{c.detail}</span></div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel row-panel">
        <div>
          <h2>Emergency</h2>
          <p className="muted" style={{ margin: 0 }}>Sign every other account out of all devices immediately.</p>
        </div>
        <button className="btn btn-danger" type="button" onClick={() => setConfirm(true)}>Sign out all accounts</button>
      </section>
      <ConfirmDialog open={confirm} title="Sign out all accounts?" confirmLabel="Sign out all" danger busy={busy}
        onCancel={() => { setConfirm(false); setTyped(""); }}
        onConfirm={async () => {
          if (typed !== "SIGN OUT ALL") return;
          setBusy(true);
          try {
            const r = await api<{ accounts: number }>("/api/admin/revoke-all", { method: "POST", body: { confirm: typed } });
            setMsg({ ok: true, text: `Signed out ${r.accounts} accounts.` });
          } catch (e) {
            setMsg({ ok: false, text: errorText(e) });
          } finally {
            setBusy(false);
            setConfirm(false);
            setTyped("");
          }
        }}>
        Every account except yours is signed out everywhere. Type <strong>SIGN OUT ALL</strong> to confirm.
        <input className="input" style={{ marginTop: "0.75rem" }} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="SIGN OUT ALL" autoComplete="off" aria-label="Type SIGN OUT ALL to confirm" />
      </ConfirmDialog>
    </div>
  );
}
