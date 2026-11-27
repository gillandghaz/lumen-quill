"use client";

import { useState } from "react";
import { api, downloadBlob, errorText } from "@/client/lib/api";

export function Backup() {
  const [range, setRange] = useState<"all" | "custom">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, setState] = useState<{ busy: boolean; text: string | null; ok: boolean }>({ busy: false, text: null, ok: true });
  const invalid = range === "custom" && (!from || !to || from > to);

  async function run() {
    setState({ busy: true, text: "Collecting…", ok: true });
    try {
      const users: unknown[] = [];
      const notes: unknown[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 400; page++) {
        const q = new URLSearchParams();
        if (cursor) q.set("cursor", cursor);
        if (range === "custom") {
          q.set("from", from);
          q.set("to", to);
        }
        const r: { users?: unknown[]; notes: unknown[]; nextCursor: string | null } = await api(`/api/admin/backup?${q}`);
        if (r.users) users.push(...r.users);
        notes.push(...r.notes);
        setState({ busy: true, text: `Collected ${notes.length} notes…`, ok: true });
        cursor = r.nextCursor;
        if (!cursor) break;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const suffix = range === "custom" ? `${from}_to_${to}` : `full-${stamp}`;
      downloadBlob(JSON.stringify({ format: "lumen-quill-backup", version: 1, exportedAt: new Date().toISOString(), range: range === "custom" ? { from, to } : "all", users, notes }, null, 2), `lumen-quill-backup-${suffix}.json`, "application/json");
      setState({ busy: false, text: `Backup ready: ${users.length} accounts, ${notes.length} notes.`, ok: true });
    } catch (e) {
      setState({ busy: false, text: errorText(e), ok: false });
    }
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>Backup</h2></div>
      <p className="muted">Every account profile and every note with its dated entries, as one JSON file. It contains private writing: store it encrypted and never share it.</p>
      <div className="backup-range">
      <div className="segmented" role="radiogroup" aria-label="Backup range">
        <button type="button" role="radio" className="seg" aria-checked={range === "all"} onClick={() => setRange("all")}>Everything</button>
        <button type="button" role="radio" className="seg" aria-checked={range === "custom"} onClick={() => setRange("custom")}>Date range</button>
      </div>
      </div>
      {range === "custom" && (
        <div className="grid-fields grid-2 tab-enter">
          <div className="field"><label className="label" htmlFor="bf">From</label><input id="bf" className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="bt">To</label><input id="bt" className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      )}
      {range === "custom" && <p className="hint">Only entries written on these days (inclusive) are included, with the notes they belong to.</p>}
      {state.text && <p className={state.ok ? "success" : "error"} role="status">{state.text}</p>}
      <div className="backup-action">
      <button className="btn btn-primary" type="button" disabled={state.busy || invalid} onClick={() => void run()}>{state.busy && <span className="spinner" aria-hidden="true" />}Download backup</button>
      </div>
    </section>
  );
}
