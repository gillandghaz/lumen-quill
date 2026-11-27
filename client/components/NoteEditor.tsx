"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, downloadFrom, errorText } from "@/client/lib/api";
import { dayLabel } from "@/shared/day";
import { LIMITS } from "@/shared/limits";
import { byteLength, wordCount } from "@/shared/text";
import { Markdown } from "./Markdown";
import { ConfirmDialog } from "./Modal";
import { confirmLeave, setPending } from "@/client/lib/unsaved";

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
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [ask, setAsk] = useState<{ kind: "note" } | { kind: "day"; day: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const onState = useCallback((day: string, st: SaveState) => setStates((cur) => (cur[day] === st ? cur : { ...cur, [day]: st })), []);

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

  // Opened from Home → Notes (/notes/{id}#d-YYYY-MM-DD): glide to that day once the note is on screen.
  useEffect(() => {
    if (!data || !window.location.hash.startsWith("#d-")) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data]);

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
    if (!data) return;
    try {
      const r = await api<{ note: NoteMeta }>(`/api/notes/${id}/entries/${day}`, { method: "DELETE" });
      setData({ ...data, note: { ...data.note, ...r.note }, entries: data.entries.filter((e) => e.day !== day) });
    } catch (e) {
      setToast(errorText(e));
    }
  }

  async function removeNote() {
    try {
      await api(`/api/notes/${id}`, { method: "DELETE" });
      router.replace("/home?tab=archive");
    } catch (e) {
      setToast(errorText(e));
    }
  }

  if (error) return <div className="panel empty"><p className="display">{error}</p><button className="btn" type="button" onClick={() => router.push("/home?tab=archive")}>Back to archive</button></div>;
  if (!data) return <div className="stack" aria-busy="true"><div className="skeleton" /><div className="skeleton tall" /></div>;

  const past = data.entries.filter((e) => e.day !== data.today);
  const todayEntry = data.entries.find((e) => e.day === data.today) ?? null;

  const all = Object.values(states);
  const overall: SaveState = all.includes("conflict") ? "conflict" : all.includes("error") ? "error" : all.includes("saving") ? "saving" : all.includes("dirty") ? "dirty" : all.includes("saved") ? "saved" : "idle";

  return (
    <>
      <div className="note-top">
        <button type="button" className="link-btn" onClick={() => { if (confirmLeave()) router.push("/home"); }}>← Home</button>
        <SaveBadge state={overall} />
      </div>
      <div className="note-head">
        <label className="sr-only" htmlFor="title">Title</label>
        <input id="title" className="title-input" value={title} maxLength={LIMITS.titleChars} onChange={(e) => setTitle(e.target.value)} onBlur={() => void saveTitle()} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <div className="btn-row">
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => downloadFrom(`/api/data/export?format=md&noteId=${id}`)}>Export .md</button>
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => downloadFrom(`/api/data/export?format=txt&noteId=${id}`)}>.txt</button>
          <button className="btn btn-sm btn-danger" type="button" onClick={() => setAsk({ kind: "note" })}>Delete</button>
        </div>
      </div>
      <p className="mono faint">{data.note.entryCount} {data.note.entryCount === 1 ? "day" : "days"} · {data.note.words} words</p>

      <div className="entries">
        {past.map((e) => (
          <section key={e.day} id={`d-${e.day}`} className="entry" aria-label={dayLabel(e.day)}>
            <div className="entry-day"><span className="date">{dayLabel(e.day)}</span></div>
            {editing.has(e.day) ? (
              <EntryEditor noteId={id} day={e.day} initialBody={e.body} initialUpdatedAt={e.updatedAt} onSaved={onSaved} onState={onState} />
            ) : (
              <div className="entry-read"><Markdown text={e.body} /></div>
            )}
            <div className="entry-tools">
              {!editing.has(e.day) && <button className="btn btn-sm btn-ghost" type="button" onClick={() => setEditing(new Set(editing).add(e.day))}>Edit</button>}
              <button className="btn btn-sm btn-ghost" type="button" onClick={() => setAsk({ kind: "day", day: e.day })}>Delete day</button>
            </div>
          </section>
        ))}

        <section id={`d-${data.today}`} className="entry entry-today" aria-label={`Today, ${dayLabel(data.today)}`}>
          <div className="entry-day"><span className="date">{dayLabel(data.today)}</span></div>
          <EntryEditor key={data.today} noteId={id} day={data.today} initialBody={todayEntry?.body ?? ""} initialUpdatedAt={todayEntry?.updatedAt ?? null} onSaved={onSaved} onState={onState} autoFocus />
        </section>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}

      <ConfirmDialog
        open={ask !== null}
        danger
        busy={busy}
        title={ask?.kind === "note" ? "Delete this note?" : "Delete this day?"}
        confirmLabel="Delete"
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          if (!ask) return;
          setBusy(true);
          if (ask.kind === "note") await removeNote();
          else await removeEntry(ask.day);
          setBusy(false);
          setAsk(null);
        }}
      >
        {ask?.kind === "note" ? "The whole note and every dated section in it are removed permanently." : ask?.kind === "day" ? `The entry of ${dayLabel(ask.day)} is removed permanently.` : null}
      </ConfirmDialog>
    </>
  );
}

/** Always-visible save status for the note: spinner while saving, a check when everything is stored. */
function SaveBadge({ state }: { state: SaveState }) {
  const text = { idle: "Saved", dirty: "Unsaved changes", saving: "Saving…", saved: "All changes saved", error: "Not saved · retrying", conflict: "Changed in another tab" }[state];
  return (
    <span className="save-badge" data-state={state} role="status" aria-live="polite">
      {state === "saving" ? <span className="spinner" aria-hidden="true" /> : state === "saved" || state === "idle" ? <span className="check" aria-hidden="true">✓</span> : <span className="pulse-dot" aria-hidden="true" />}
      {text}
    </span>
  );
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";
const LABEL: Record<SaveState, string> = { idle: "", dirty: "Unsaved", saving: "Saving…", saved: "Saved", error: "Not saved · retrying", conflict: "Changed in another tab · reload" };
const DEBOUNCE_MS = 1200;

/** One day's text with debounced autosave, retry on failure, flush on leave, and a guard against two-tab overwrites. */
function EntryEditor({ noteId, day, initialBody, initialUpdatedAt, onSaved, onState, autoFocus }: {
  noteId: string;
  day: string;
  initialBody: string;
  initialUpdatedAt: number | null;
  onSaved: (n: NoteMeta) => void;
  onState: (day: string, s: SaveState) => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<SaveState>("idle");
  const base = useRef<number | null>(initialUpdatedAt);
  const saved = useRef(initialBody);
  const latest = useRef(initialBody);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const key = `${noteId}/${day}`;

  // Report to the note header and to the unsaved-changes guard (browser "Leave site?" dialog).
  useEffect(() => {
    onState(day, state);
    setPending(key, state === "dirty" || state === "saving" || state === "error");
  }, [state, day, key, onState]);
  useEffect(() => () => setPending(key, false), [key]);

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
    // The "Leave site?" dialog itself comes from client/lib/unsaved.ts; here we only try one last save.
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
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
        <span className="save-state" data-state={state}>{state === "saving" && <span className="spinner spinner-xs" aria-hidden="true" />}{LABEL[state]}</span>
        <span className="mono">{wordCount(body)} words</span>
        {state === "conflict" && <button className="btn btn-sm" type="button" onClick={() => window.location.reload()}>Reload</button>}
      </div>
    </>
  );
}
