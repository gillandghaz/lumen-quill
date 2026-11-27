"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorText } from "@/client/lib/api";
import { shortDayLabel } from "@/shared/day";
import type { NextDayBehavior } from "@/shared/limits";

interface NoteMeta {
  id: string;
  title: string;
  updatedAt: number;
  firstDay: string | null;
  lastDay: string | null;
  entryCount: number;
  words: number;
  preview: string;
}
interface Target { today: string; latest: NoteMeta | null; writtenToday: boolean; nextDay: NextDayBehavior }

export function Archive({ username }: { username: string }) {
  const router = useRouter();
  const [items, setItems] = useState<NoteMeta[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (opts: { cursor?: string | null; q?: string } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (opts.cursor) params.set("cursor", opts.cursor);
      if (opts.q) params.set("q", opts.q);
      const r = await api<{ items: NoteMeta[]; nextCursor: string | null }>(`/api/notes?${params}`);
      setItems((prev) => (opts.cursor ? [...prev, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function newNote() {
    setBusy(true);
    try {
      const n = await api<NoteMeta>("/api/notes", { method: "POST", body: {} });
      router.push(`/notes/${n.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  /** "Write": same day -> continue the latest note; a later day -> follow the user's setting (ask by default). */
  async function write() {
    setBusy(true);
    try {
      const t = await api<Target>("/api/notes/write-target");
      if (!t.latest) return void (await newNote());
      if (t.writtenToday || t.nextDay === "continue") return router.push(`/notes/${t.latest.id}`);
      if (t.nextDay === "new") return void (await newNote());
      setAsk(t);
      setBusy(false);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="label glyph">Archive of {username}</p>
          <h1>Your notes</h1>
        </div>
        <div className="btn-row">
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void newNote()}>New note</button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void write()}>Write today</button>
        </div>
      </div>

      <form
        className="field"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void load({ q: q.trim() });
        }}
      >
        <label className="sr-only" htmlFor="q">Search notes</label>
        <input id="q" className="input" type="search" placeholder="Search titles and latest lines…" maxLength={100} value={q} onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value === "") void load();
        }} />
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {!loading && items.length === 0 && !error ? (
        <div className="panel empty">
          <p className="display">The archive is quiet</p>
          <p>Begin with today. Everything you write is kept under the date you wrote it.</p>
          <button className="btn btn-primary" type="button" onClick={() => void write()}>Write today</button>
        </div>
      ) : (
        <div className="note-list">
          {items.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`} className="note-card">
              <span className="note-title">{n.title}</span>
              <span className="note-meta">
                {n.lastDay ? shortDayLabel(n.lastDay) : "empty"} · {n.entryCount} {n.entryCount === 1 ? "day" : "days"} · {n.words} words
              </span>
              {n.preview && <span className="note-preview">{n.preview}</span>}
            </Link>
          ))}
        </div>
      )}

      {loading && <p className="muted mono" role="status">Loading…</p>}
      {cursor && !loading && (
        <p style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <button className="btn btn-ghost" type="button" onClick={() => void load({ cursor })}>Load more</button>
        </p>
      )}

      {ask && ask.latest && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ask-title" onClick={() => setAsk(null)}>
          <div className="panel modal" onClick={(e) => e.stopPropagation()}>
            <p className="label glyph">A new day · {shortDayLabel(ask.today)}</p>
            <h2 id="ask-title">Continue or begin anew?</h2>
            <p className="muted">Your latest note, <strong>{ask.latest.title}</strong>, was last written on {ask.latest.lastDay ? shortDayLabel(ask.latest.lastDay) : "an earlier day"}.</p>
            <div className="choice-grid">
              <button className="choice" type="button" onClick={() => router.push(`/notes/${ask.latest!.id}`)}>
                <strong>Continue “{ask.latest.title}”</strong>
                <span className="muted">Adds a new section dated today to the same note.</span>
              </button>
              <button className="choice" type="button" onClick={() => { setAsk(null); void newNote(); }}>
                <strong>Start a new note</strong>
                <span className="muted">A separate note that begins today.</span>
              </button>
            </div>
            <p className="hint" style={{ margin: "1rem 0 0" }}>You can make this automatic in Settings.</p>
          </div>
        </div>
      )}
    </>
  );
}
