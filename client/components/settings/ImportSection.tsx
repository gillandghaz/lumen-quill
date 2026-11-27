"use client";

import { useEffect, useRef, useState } from "react";
import { planImport, runImport, type ImportPlan, type ImportProgress } from "@/client/lib/importer";
import { setPending } from "@/client/lib/unsaved";
import { dayKey } from "@/shared/day";
import { LIMITS } from "@/shared/limits";

const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/**
 * Import any number of .md / .txt files or a whole folder. Files are read and parsed here, previewed, then sent in
 * small chunks with a progress bar. Re-running an import never duplicates notes.
 */
export function ImportSection({ timeZone }: { timeZone: string }) {
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // React does not know the folder-picker attribute; set it on the element.
  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
    folderRef.current?.setAttribute("directory", "");
  }, []);
  // Leaving the page mid-import gets the browser's own "Leave site?" warning.
  useEffect(() => {
    setPending("import", running);
    return () => setPending("import", false);
  }, [running]);

  async function choose(list: FileList | null) {
    if (!list || list.length === 0) return;
    setMsg(null);
    setProgress(null);
    setReading(true);
    try {
      const p = await planImport([...list], dayKey(Date.now(), timeZone));
      if (p.notes.length === 0) setMsg({ ok: false, text: p.files === 0 ? "No .md or .txt files were found." : "Nothing to import in those files." });
      else setPlan(p);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setReading(false);
      if (filesRef.current) filesRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  }

  async function start() {
    if (!plan) return;
    setRunning(true);
    const r = await runImport(plan.notes, setProgress);
    setRunning(false);
    const p = r.progress;
    const done = `${p.created} ${p.created === 1 ? "note" : "notes"} imported with ${p.entries} dated ${p.entries === 1 ? "entry" : "entries"}${p.skipped ? `, ${p.skipped} already imported before (skipped)` : ""}.`;
    if (r.ok) {
      setMsg({ ok: true, text: `Done: ${done}` });
      setPlan(null);
    } else {
      setMsg({ ok: false, text: `Stopped after ${p.sent} of ${p.total}: ${done} ${r.message}` });
    }
  }

  const pct = progress && progress.total ? Math.round((progress.sent / progress.total) * 100) : 0;

  return (
    <section className="panel">
      <div className="row-panel">
        <div>
          <h2>Import</h2>
          <p className="muted" style={{ margin: 0 }}>
            .md or .txt files, any number (up to {LIMITS.importMaxFiles} files / 50 MB at once), or a whole folder. Each note becomes a new note; dated sections keep their dates. Importing the same notes again never creates duplicates.
          </p>
        </div>
        <div className="btn-row">
          <input ref={filesRef} className="sr-only" id="import-files" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple onChange={(e) => void choose(e.target.files)} />
          <input ref={folderRef} className="sr-only" id="import-folder" type="file" multiple onChange={(e) => void choose(e.target.files)} />
          <label htmlFor="import-files" className="btn" aria-disabled={reading || running}>{reading ? <><span className="spinner" aria-hidden="true" />Reading…</> : "Choose files"}</label>
          <label htmlFor="import-folder" className="btn btn-ghost" aria-disabled={reading || running}>Choose folder</label>
        </div>
      </div>

      {plan && (
        <div className="import-plan tab-enter">
          <p className="import-summary">
            <strong>{plan.files}</strong> {plan.files === 1 ? "file" : "files"} · <strong>{plan.notes.length}</strong> {plan.notes.length === 1 ? "note" : "notes"} · <strong>{plan.days}</strong> dated {plan.days === 1 ? "day" : "days"} · {kb(plan.bytes)}
          </p>
          {plan.skippedFiles.length > 0 && <p className="hint">Ignored (not .md / .txt): {plan.skippedFiles.slice(0, 5).join(", ")}{plan.skippedFiles.length > 5 ? ` and ${plan.skippedFiles.length - 5} more` : ""}</p>}
          {plan.notes.length + plan.days > 15_000 && <p className="hint">This is large. The free database allows about 20,000 writes a day; if the limit is reached, run the same import again tomorrow to finish.</p>}
          {(running || progress) && (
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Import progress">
              <span style={{ width: `${pct}%` }} />
            </div>
          )}
          {progress && <p className="mono faint">{progress.sent} / {progress.total} notes · {progress.created} new · {progress.skipped} skipped</p>}
          <div className="btn-row">
            <button className="btn btn-primary" type="button" disabled={running} onClick={() => void start()}>{running ? <><span className="spinner" aria-hidden="true" />Importing…</> : `Import ${plan.notes.length} ${plan.notes.length === 1 ? "note" : "notes"}`}</button>
            {!running && <button className="btn btn-ghost" type="button" onClick={() => { setPlan(null); setProgress(null); }}>Cancel</button>}
          </div>
        </div>
      )}
      {msg && <p className={msg.ok ? "success" : "error"} role="status" style={{ marginTop: "0.75rem" }}>{msg.text}</p>}
    </section>
  );
}
