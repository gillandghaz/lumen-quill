"use client";

import { useState } from "react";
import { api, errorText } from "@/client/lib/api";
import { ImportSection } from "./ImportSection";
import { ExportButton } from "../ExportButton";
import { ConfirmDialog } from "../Modal";

export function DataTab({ timeZone }: { timeZone: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="stack">
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}

      <section className="panel row-panel">
        <div>
          <h2>Export</h2>
          <p className="muted" style={{ margin: 0 }}>Every note in one light file. Each day is a <code>## YYYY-MM-DD</code> section.</p>
        </div>
        <div className="btn-row">
          <ExportButton href="/api/data/export?format=md" label=".md" primary />
          <ExportButton href="/api/data/export?format=txt" label=".txt" />
        </div>
      </section>

      <ImportSection timeZone={timeZone} />

      <section className="panel danger-zone">
        <h2>Delete everything</h2>
        <p className="muted">Permanently removes all of your notes. Export first if you want a copy. Type <strong>DELETE ALL</strong> to continue.</p>
        <div className="inline-form">
          <label className="sr-only" htmlFor="confirm">Confirmation</label>
          <input id="confirm" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE ALL" autoComplete="off" />
          <button className="btn btn-danger" type="button" disabled={busy || typed !== "DELETE ALL"} onClick={() => setConfirm(true)}>Delete all notes</button>
        </div>
      </section>

      <ConfirmDialog open={confirm} title="Delete all notes?" confirmLabel="Yes, delete everything" danger busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            const r = await api<{ notes: number }>("/api/data/delete-all", { method: "POST", body: { confirm: typed } });
            setMsg({ ok: true, text: `Deleted ${r.notes} ${r.notes === 1 ? "note" : "notes"}.` });
            setTyped("");
          } catch (e) {
            setMsg({ ok: false, text: errorText(e) });
          } finally {
            setBusy(false);
            setConfirm(false);
          }
        }}>
        This is the last step. Every note and every dated entry will be removed permanently and cannot be recovered.
      </ConfirmDialog>
    </div>
  );
}
