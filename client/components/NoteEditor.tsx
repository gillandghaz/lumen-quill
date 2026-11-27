"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, downloadFrom, errorText } from "@/client/lib/api";
import { dayLabel } from "@/shared/day";
import { LIMITS } from "@/shared/limits";
import { byteLength, wordCount } from "@/shared/text";
import { Markdown } from "./Markdown";

interface Entry { day: string; body: string; words: number; createdAt: number; updatedAt: number }
interface NoteMeta { id: string; title: string; entryCount: number; words: number; lastDay: string | null }
interface NoteData { note: NoteMeta; entries: Entry[]; today: string }

export function NoteEditor({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<NoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<NoteData>(`/api/notes/${id}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setTitle(d.note.title);
      })
      .catch((e) => alive && setError(e instanceof ApiError && e.status === 404 ? "This note does not exist." : errorText(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const onSaved = useCallback((note: NoteMeta) => setData((d) => (d ? { ...d, note: { ...d.note, ...note } } : d)), []);

  async function saveTitle() {
    if (!data || title.trim() === data.note.title) return;
    try {
      await api(`/api/notes/${id}`, { method: "PATCH", body: { title } });
      setData({ ...data, note: { ...data.note, title: title.trim() || "Untitled note" } });
    } catch (e) {
      setToast(errorText(e));
    }
  }

  async function removeEntry(day: string) {
    if (!data || !window.confirm(`Delete the entry of ${dayLabel(day)}? This cannot be undone.`)) return;
    try {
      const r = await api<{ note: NoteMeta }>(`/api/notes/${id}/entries/${day}`, { method: "DELETE" });
      setData({ ...data, note: { ...data.note, ...r.note }, entries: data.entries.filter((e) => e.day !== day) });
    } catch (e) {
      setToast(errorText(e));
    }
  }

  async function removeNote() {
    if (!window.confirm("Delete this whole note and all of its days? This cannot be undone.")) return;
    try {
      await api(`/api/notes/${id}`, { method: "DELETE" });
      router.replace("/archive");
    } catch (e) {
      setToast(errorText(e));
    }
  }

  if (error) return <div className="panel empty"><p className="display">{error}</p><button className="btn" type="button" onClick={() => router.push("/archive")}>Back to archive</button></div>;
  if (!data) return <p className="muted mono" role="status">Opening note…</p>;

  const past = data.entries.filter((e) => e.day !== data.today);
  const todayEntry = data.entries.find((e) => e.day === data.today) ?? null;

  return (
    <>
      <div className="note-head">
        <label className="sr-only" htmlFor="title">Title</label>
        <input id="title" className="title-input" value={title} maxLength={LIMITS.titleChars} onChange={(e) => setTitle(e.target.value)} onBlur={() => void saveTitle()} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <div className="btn-row">
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => downloadFrom(`/api/data/export?format=md&noteId=${id}`)}>Export .md</button>
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => downloadFrom(`/api/data/export?format=txt&noteId=${id}`)}>.txt</button>
          <button className="btn btn-sm btn-danger" type="button" onClick={() => void removeNote()}>Delete</button>
        </div>
      </div>
      <p className="mono faint">{data.note.entryCount} {data.note.entryCount === 1 ? "day" : "days"} · {data.note.words} words</p>

      <div className="entries">
        {past.map((e) => (
          <section key={e.day} aria-label={dayLabel(e.day)}>
            <div className="entry-day"><span className="date">{dayLabel(e.day)}</span></div>
            {editing.has(e.day) ? (
              <EntryEditor noteId={id} day={e.day} initialBody={e.body} initialUpdatedAt={e.updatedAt} onSaved={onSaved} />
            ) : (
              <div className="entry-read"><Markdown text={e.body} /></div>
            )}
            <div className="entry-tools">
              {!editing.has(e.day) && <button className="btn btn-sm btn-ghost" type="button" onClick={() => setEditing(new Set(editing).add(e.day))}>Edit</button>}
              <button className="btn btn-sm btn-ghost" type="button" onClick={() => void removeEntry(e.day)}>Delete day</button>
            </div>
          </section>
        ))}

        <section className="entry-today" aria-label={`Today, ${dayLabel(data.today)}`}>
          <div className="entry-day"><span className="date">{dayLabel(data.today)}</span></div>
          <EntryEditor key={data.today} noteId={id} day={data.today} initialBody={todayEntry?.body ?? ""} initialUpdatedAt={todayEntry?.updatedAt ?? null} onSaved={onSaved} autoFocus />
        </section>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";
const LABEL: Record<SaveState, string> = { idle: "", dirty: "Unsaved", saving: "Saving…", saved: "Saved", error: "Not saved · retrying", conflict: "Changed elsewhere · reload" };
const DEBOUNCE_MS = 1200;

/** One day's text with debounced autosave, retry on failure, flush on leave, and a guard against two-tab overwrites. */
function EntryEditor({ noteId, day, initialBody, initialUpdatedAt, onSaved, autoFocus }: {
  noteId: string;
  day: string;
  initialBody: string;
  initialUpdatedAt: number | null;
  onSaved: (n: NoteMeta) => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<SaveState>("idle");
  const base = useRef<number | null>(initialUpdatedAt);
  const saved = useRef(initialBody);
  const latest = useRef(initialBody);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    const text = latest.current;
    if (text === saved.current) return;
    if (byteLength(text) > LIMITS.entryBytes) return setState("error");
    inFlight.current = true;
    setState("saving");
    try {
      const r = await api<{ entry: Entry | null; note: NoteMeta }>(`/api/notes/${noteId}/entries/${day}`, { method: "PUT", body: { body: text, baseUpdatedAt: base.current } });
      saved.current = text;
      if (r.entry) base.current = r.entry.updatedAt;
      onSaved(r.note);
      setState(latest.current === text ? "saved" : "dirty");
    } catch (e) {
      if (e instanceof ApiError && e.code === "conflict") {
        setState("conflict");
      } else {
        setState("error");
        timer.current = setTimeout(() => void save(), 5000);
      }
    } finally {
      inFlight.current = false;
    }
    if (latest.current !== saved.current && !timer.current) timer.current = setTimeout(() => { timer.current = null; void save(); }, DEBOUNCE_MS);
  }, [noteId, day, onSaved]);

  useEffect(() => {
    // Last-chance save when the tab closes or navigates away.
    const flush = () => {
      if (latest.current !== saved.current) {
        void fetch(`/api/notes/${noteId}/entries/${day}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: latest.current, baseUpdatedAt: base.current }),
          credentials: "same-origin",
          keepalive: byteLength(latest.current) < 60_000,
        });
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current !== saved.current) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, [noteId, day]);

  return (
    <>
      <label className="sr-only" htmlFor={`e-${day}`}>Entry for {dayLabel(day)}</label>
      <textarea
        id={`e-${day}`}
        className="editor"
        value={body}
        autoFocus={autoFocus}
        placeholder="Write…"
        spellCheck
        disabled={state === "conflict"}
        onChange={(e) => {
          setBody(e.target.value);
          latest.current = e.target.value;
          setState("dirty");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => { timer.current = null; void save(); }, DEBOUNCE_MS);
        }}
        onBlur={() => void save()}
      />
      <div className="entry-tools">
        <span className="save-state" data-state={state} aria-live="polite">{LABEL[state]}</span>
        <span className="mono">{wordCount(body)} words</span>
        {state === "conflict" && <button className="btn btn-sm" type="button" onClick={() => window.location.reload()}>Reload</button>}
      </div>
    </>
  );
}
