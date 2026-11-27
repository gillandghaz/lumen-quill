"use client";

import { useRef, useState } from "react";
import type { PageUser } from "@/server/page-guards";
import { api, downloadFrom, errorText } from "@/client/lib/api";
import { LIMITS } from "@/shared/limits";

export function DataPanel({ user: _user }: { user: PageUser }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");

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

  async function deleteAll() {
    setBusy(true);
    try {
      const r = await api<{ notes: number }>("/api/data/delete-all", { method: "POST", body: { confirm } });
      setMsg({ ok: true, text: `Deleted ${r.notes} notes.` });
      setConfirm("");
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="label glyph">Data</p>
          <h1>Export &amp; import</h1>
        </div>
      </div>
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Export</h2></div>
          <p className="muted">Download every note in one light file. Markdown keeps headings readable in any editor; plain text works everywhere. Each day is a <code>## YYYY-MM-DD</code> section.</p>
          <div className="btn-row">
            <button className="btn btn-primary" type="button" onClick={() => downloadFrom("/api/data/export?format=md")}>Export all · .md</button>
            <button className="btn" type="button" onClick={() => downloadFrom("/api/data/export?format=txt")}>Export all · .txt</button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Import</h2></div>
          <p className="muted">Choose .md or .txt files (up to {LIMITS.importFiles}, 2 MB in total). Each becomes a new note. Sections headed <code>## YYYY-MM-DD</code> keep their dates; other text is dated today.</p>
          <input ref={fileRef} className="sr-only" id="import" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple onChange={(e) => void importFiles(e.target.files)} />
          <label htmlFor="import" className="btn" aria-disabled={busy}>{busy ? "Working…" : "Choose files"}</label>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Delete everything</h2></div>
          <p className="muted">Permanently removes all of your notes. Export first if you want a copy. Type <strong>DELETE ALL</strong> to confirm.</p>
          <div className="field">
            <label className="sr-only" htmlFor="confirm">Confirmation</label>
            <input id="confirm" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE ALL" />
          </div>
          <button className="btn btn-danger" type="button" disabled={busy || confirm !== "DELETE ALL"} onClick={() => void deleteAll()}>Delete all notes</button>
        </section>
      </div>
    </>
  );
}
