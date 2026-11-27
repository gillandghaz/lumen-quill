"use client";

import { useRef, useState } from "react";
import { api, downloadFrom, errorText } from "@/client/lib/api";
import { LIMITS } from "@/shared/limits";
import { ConfirmDialog } from "../Modal";

export function DataTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [confirm, setConfirm] = useState(false);

  async function importFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = [...list];
    if (files.length > LIMITS.importFiles) return setMsg({ ok: false, text: `Import at most ${LIMITS.importFiles} files at once.` });
    if (files.some((f) => !/\.(md|markdown|txt)$/i.test(f.name))) return setMsg({ ok: false, text: "Only .md and .txt files can be imported." });
    if (files.reduce((n, f) => n + f.size, 0) > LIMITS.importTotalBytes) return setMsg({ ok: false, text: "Those files are too large together (2 MB maximum)." });
    setBusy(true);
    setMsg(null);
    try {
      const payload = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
      const r = await api<{ notes: number; entries: number }>("/api/data/import", { method: "POST", body: { files: payload } });
      setMsg({ ok: true, text: `Imported ${r.notes} ${r.notes === 1 ? "note" : "notes"} with ${r.entries} dated ${r.entries === 1 ? "entry" : "entries"}.` });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="stack">
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}

      <section className="panel row-panel">
        <div>
          <h2>Export</h2>
          <p className="muted" style={{ margin: 0 }}>Every note in one light file. Each day is a <code>## YYYY-MM-DD</code> section.</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" type="button" onClick={() => downloadFrom("/api/data/export?format=md")}>.md</button>
          <button className="btn" type="button" onClick={() => downloadFrom("/api/data/export?format=txt")}>.txt</button>
        </div>
      </section>

      <section className="panel row-panel">
        <div>
          <h2>Import</h2>
          <p className="muted" style={{ margin: 0 }}>.md or .txt files (up to {LIMITS.importFiles}, 2 MB in total). Each becomes a new note; dated sections keep their dates.</p>
        </div>
        <div>
          <input ref={fileRef} className="sr-only" id="import" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple onChange={(e) => void importFiles(e.target.files)} />
          <label htmlFor="import" className="btn" aria-disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Importing…</> : "Choose files"}</label>
        </div>
      </section>

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
