"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/client/lib/api";
import { NOTES_PAGE_SIZE } from "@/shared/limits";
import { Pagination } from "../Pagination";
import { SkeletonRows } from "./OverviewTab";
import type { NoteMeta } from "./useWriteToday";

/**
 * Archive: the list of notes in the order they were created (newest first; editing never reshuffles it). Rows show
 * only the title and facts, no content, so a page holds NOTES_PAGE_SIZE (20); the total is one cheap count.
 */
export function ArchiveTab({ onWrite }: { onWrite: () => void }) {
  const [items, setItems] = useState<NoteMeta[] | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null, first: boolean, search = "") => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (search) params.set("q", search);
      else if (first) params.set("count", "1");
      const r = await api<{ items: NoteMeta[]; nextCursor: string | null; total?: number }>(`/api/notes?${params}`);
      setItems(r.items);
      setNext(r.nextCursor);
      if (typeof r.total === "number") setTotal(r.total);
      setErr(null);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(null, true);
  }, [load]);

  function go(p: number, cursor: string | null) {
    setPage(p);
    void load(cursor, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const s = q.trim();
          setSearching(Boolean(s));
          setPage(0);
          setCursors([null]);
          void load(null, true, s);
        }}
      >
        <label className="sr-only" htmlFor="q">Search notes</label>
        <input id="q" className="input" type="search" placeholder="Search titles…" maxLength={100} value={q} onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value === "" && searching) {
            setSearching(false);
            setPage(0);
            setCursors([null]);
            void load(null, true);
          }
        }} />
        <button className="btn btn-ghost" type="submit">Search</button>
      </form>

      {err && <p className="error" role="alert">{err}</p>}
      {!items ? (
        <SkeletonRows n={6} />
      ) : items.length === 0 ? (
        <div className="panel empty">
          <p className="display">{searching ? "Nothing found" : "The archive is quiet"}</p>
          {!searching && <><p>Begin with today. Everything you write is kept under the date you wrote it.</p><button className="btn btn-primary" type="button" onClick={onWrite}>Write today</button></>}
        </div>
      ) : (
        <div className={`note-list${busy ? " is-busy" : ""}`}>
          {items.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`} className="note-card">
              <span className="note-title trunc">{n.title}</span>
              <span className="note-meta">created {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {n.entryCount} {n.entryCount === 1 ? "day" : "days"} · {n.words} words</span>
            </Link>
          ))}
        </div>
      )}
      {!searching && (
        <Pagination
          page={page + 1}
          pages={total !== null ? Math.max(1, Math.ceil(total / NOTES_PAGE_SIZE)) : null}
          canPrev={page > 0}
          canNext={next !== null}
          busy={busy}
          onPrev={() => go(page - 1, cursors[page - 1] ?? null)}
          onNext={() => { const p = page + 1; setCursors((c) => { const n = [...c]; n[p] = next; return n; }); go(p, next); }}
        />
      )}
    </>
  );
}
