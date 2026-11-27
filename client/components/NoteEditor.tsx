"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, downloadFrom, errorText } from "@/client/lib/api";
import { dayLabel } from "@/shared/day";
import { LIMITS } from "@/shared/limits";
import { byteLength, wordCount } from "@/shared/text";
import { ConfirmDialog } from "./Modal";
import { Markdown } from "./Markdown";
import { LiveText } from "./LiveText";
import { confirmLeave, setPending } from "@/client/lib/unsaved";

interface Entry { day: string; body: string; words: number; createdAt: number; updatedAt: number }
interface NoteMeta { id: string; title: string; entryCount: number; words: number; lastDay: string | null }
interface NoteData { note: NoteMeta; entries: Entry[]; today: string }

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

/**
 * One note = dated sections. Only TODAY's section can be written; every earlier day is locked (read-only, sized to its
 * text, deletable). Opening a note lands on today's section with the cursor after the last character.
 * - Note already has today              → today's box is open (same day: just continue).
 * - Note is empty / just created        → today's box is open.
 * - Arrived via "Continue" (?continue=1) → a new section for today is open.
 * - Otherwise (an older note opened from the archive) → read-only, with "Continue this note today".
 */
export function NoteEditor({ id, continueToday }: { id: string; continueToday: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<NoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>("idle");
  const [writing, setWriting] = useState(continueToday);
  const [ask, setAsk] = useState<{ kind: "note" } | { kind: "day"; day: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Leaving a note that has nothing written (no dated section and today's box empty) removes it.
  const entryCountRef = useRef<number | null>(null);
  const hasTextRef = useRef(false);
  const onText = useCallback((has: boolean) => { hasTextRef.current = has; }, []);
  useEffect(() => {
    entryCountRef.current = data ? data.note.entryCount : null;
  }, [data]);
  useEffect(() => {
    const dropIfEmpty = () => {
      if (entryCountRef.current === 0 && !hasTextRef.current) {
        entryCountRef.current = null; // once
        void fetch(`/api/notes/${id}?ifEmpty=1`, { method: "DELETE", credentials: "same-origin", keepalive: true });
      }
    };
    window.addEventListener("pagehide", dropIfEmpty);
    return () => {
      window.removeEventListener("pagehide", dropIfEmpty);
      dropIfEmpty();
    };
  }, [id]);

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

  if (error) return <div className="panel empty"><p className="display">{error}</p><button className="btn" type="button" onClick={() => router.push("/home")}>Back home</button></div>;
  if (!data) return <div className="stack" aria-busy="true"><div className="skeleton" /><div className="skeleton tall" /></div>;

  const past = data.entries.filter((e) => e.day !== data.today);
  const todayEntry = data.entries.find((e) => e.day === data.today) ?? null;
  const open = writing || todayEntry !== null || data.entries.length === 0;

  return (
    <>
      <div className="note-top">
        <button type="button" className="link-btn" onClick={() => { if (confirmLeave()) router.push("/home"); }}>← Home</button>
        <SaveBadge state={open ? state : "idle"} />
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
      <p className="mono faint note-stats">{data.note.entryCount} {data.note.entryCount === 1 ? "day" : "days"} · {data.note.words} words</p>

      <div className="entries">
        {past.map((e) => (
          <section key={e.day} id={`d-${e.day}`} className="entry entry-past" aria-label={`${dayLabel(e.day)} (locked)`}>
            <div className="entry-day">
              <span className="date">{dayLabel(e.day)}</span>
              <span className="lock-tag">Locked</span>
            </div>
            <div className="editor editor-locked editor-rendered" aria-readonly="true"><Markdown text={e.body} /></div>
            <div className="entry-tools">
              <span className="mono faint">{e.words} words</span>
              <button className="btn btn-sm btn-ghost" type="button" onClick={() => setAsk({ kind: "day", day: e.day })}>Delete day</button>
            </div>
          </section>
        ))}

        {open ? (
          <section id={`d-${data.today}`} className="entry entry-today" aria-label={`Today, ${dayLabel(data.today)}`}>
            <div className="entry-day"><span className="date">{dayLabel(data.today)}</span></div>
            <TodayEditor key={data.today} noteId={id} day={data.today} initialBody={todayEntry?.body ?? ""} initialUpdatedAt={todayEntry?.updatedAt ?? null} onSaved={onSaved} onState={setState} onText={onText} />
          </section>
        ) : (
          <div className="continue-box">
            <p className="muted">Last written on {past.length ? dayLabel(past[past.length - 1]!.day) : "an earlier day"}. Earlier days are locked.</p>
            <button className="btn btn-primary" type="button" onClick={() => setWriting(true)}>Continue this note today</button>
          </div>
        )}
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
          try {
            if (ask.kind === "note") {
              await api(`/api/notes/${id}`, { method: "DELETE" });
              entryCountRef.current = null;
              router.replace("/home?tab=archive");
              return;
            }
            const day = ask.day;
            const r = await api<{ note: NoteMeta }>(`/api/notes/${id}/entries/${day}`, { method: "DELETE" });
            setData((d) => (d ? { ...d, note: { ...d.note, ...r.note }, entries: d.entries.filter((e) => e.day !== day) } : d));
          } catch (e) {
            setToast(errorText(e));
          } finally {
            setBusy(false);
            setAsk(null);
          }
        }}
      >
        {ask?.kind === "note" ? "The whole note and every dated section in it are removed permanently." : ask?.kind === "day" ? `The entry of ${dayLabel(ask.day)} is removed permanently.` : null}
      </ConfirmDialog>
    </>
  );
}

/** Fixed-width save status, so text changes never shift the page. */
function SaveBadge({ state }: { state: SaveState }) {
  const text = { idle: "All changes saved", dirty: "Unsaved changes", saving: "Saving…", saved: "All changes saved", error: "Not saved · retrying", conflict: "Changed in another tab" }[state];
  return (
    <span className="save-badge" data-state={state} role="status" aria-live="polite">
      <span className="save-icon" aria-hidden="true">
        {state === "saving" ? <span className="spinner" /> : state === "saved" || state === "idle" ? "✓" : <span className="pulse-dot" />}
      </span>
      <span className="save-text">{text}</span>
    </span>
  );
}

const DEBOUNCE_MS = 1200;

/**
 * Today's text: debounced autosave, retry when offline, last-chance save on page hide, and a guard against two tabs
 * overwriting each other. Continuing on the same day adds one line break so you can start writing straight away
 * (it is only stored if you type). The box grows with the text, and the cursor starts after the last character.
 */
function TodayEditor({ noteId, day, initialBody, initialUpdatedAt, onSaved, onState, onText }: {
  noteId: string;
  day: string;
  initialBody: string;
  initialUpdatedAt: number | null;
  onSaved: (n: NoteMeta) => void;
  onState: (s: SaveState) => void;
  onText: (hasText: boolean) => void;
}) {
  const start = initialBody && !initialBody.endsWith("\n") ? `${initialBody}\n` : initialBody;
  const [body, setBody] = useState(start);
  const [state, setState] = useState<SaveState>("idle");
  const ref = useRef<HTMLTextAreaElement>(null);
  const base = useRef<number | null>(initialUpdatedAt);
  const saved = useRef(start); // the added line break alone is not a change worth saving
  const latest = useRef(start);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const key = `${noteId}/${day}`;

  useEffect(() => {
    onState(state);
    setPending(key, state === "dirty" || state === "saving" || state === "error");
  }, [state, key, onState]);
  useEffect(() => () => setPending(key, false), [key]);
  useEffect(() => onText(body.trim() !== ""), [body, onText]);

  // Grow with the text instead of scrolling inside the box.
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight + 2, 224)}px`;
  }, []);
  useLayoutEffect(fit, [body, fit]);

  // Land on today's section with the cursor after the last character.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const end = el.value.length;
    el.focus({ preventScroll: true });
    el.setSelectionRange(end, end);
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, window.scrollY + r.bottom - window.innerHeight + 120), behavior: "smooth" });
    });
  }, []);

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
      if (e instanceof ApiError && (e.code === "conflict" || e.code === "day_locked")) {
        setState("conflict");
      } else {
        setState("error");
        timer.current = setTimeout(() => { timer.current = null; void save(); }, 5000);
      }
    } finally {
      inFlight.current = false;
    }
    if (latest.current !== saved.current && !timer.current) timer.current = setTimeout(() => { timer.current = null; void save(); }, DEBOUNCE_MS);
  }, [noteId, day, onSaved]);

  useEffect(() => {
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
      {/* Live formatting: the styled mirror sits behind a transparent textarea with the same box and text. */}
      <div className="live-editor">
        <div className="editor editor-today editor-mirror" aria-hidden="true"><LiveText text={body} /></div>
      <textarea
        ref={ref}
        id={`e-${day}`}
        className="editor editor-today editor-input"
        value={body}
        placeholder="Write…"
        spellCheck
        disabled={state === "conflict"}
        onChange={(e) => {
          setBody(e.target.value);
          latest.current = e.target.value;
          setState(e.target.value === saved.current ? "saved" : "dirty");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => { timer.current = null; void save(); }, DEBOUNCE_MS);
        }}
        onBlur={() => void save()}
      />
      </div>
      <div className="entry-tools">
        <span className="mono faint">{wordCount(body)} words</span>
        {state === "conflict" && <button className="btn btn-sm" type="button" onClick={() => window.location.reload()}>Reload</button>}
      </div>
    </>
  );
}
