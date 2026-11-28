"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/client/lib/api";
import { dayLabel } from "@/shared/day";
import { Pagination } from "../Pagination";
import { SkeletonRows } from "./OverviewTab";

interface Item { noteId: string; noteTitle: string; day: string; words: number; preview: string; updatedAt: number }

const monthOf = (day: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** Notes: every dated entry across all notes, newest first, grouped by month (20 per page). */
export function NotesTab({ onWrite }: { onWrite: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null) => {
    setBusy(true);
    try {
      const r = await api<{ items: Item[]; nextCursor: string | null }>(`/api/home/notes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      setItems(r.items);
      setNext(r.nextCursor);
      setErr(null);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  if (err) return <p className="error">{err}</p>;
  if (!items) return <SkeletonRows n={5} />;
  if (items.length === 0 && page === 0) {
    return (
      <div className="panel empty">
        <p className="display">No entries yet</p>
        <p>Every day you write appears here, newest first.</p>
        <button className="btn btn-primary" type="button" onClick={onWrite}>Write today</button>
      </div>
    );
  }

  let lastMonth = "";
  return (
    <>
      <div className={`timeline${busy ? " is-busy" : ""}`}>
        {items.map((it) => {
          const m = monthOf(it.day);
          const head = m !== lastMonth ? <h3 className="month">{m}</h3> : null;
          lastMonth = m;
          return (
            <div key={`${it.noteId}-${it.day}`}>
              {head}
              <Link prefetch={false} href={`/notes/${it.noteId}#d-${it.day}`} className="timeline-item">
                <span className="timeline-dot" aria-hidden="true" />
                <span className="timeline-day">{dayLabel(it.day)}</span>
                <span className="timeline-note trunc">{it.noteTitle}</span>
                {it.preview && <span className="timeline-preview">{it.preview}</span>}
                <span className="timeline-words mono faint">{it.words} words</span>
              </Link>
            </div>
          );
        })}
      </div>
      <Pagination
        page={page + 1}
        pages={null}
        canPrev={page > 0}
        canNext={next !== null}
        busy={busy}
        onPrev={() => { const p = page - 1; setPage(p); void load(cursors[p] ?? null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        onNext={() => { const p = page + 1; setCursors((c) => { const n = [...c]; n[p] = next; return n; }); setPage(p); void load(next); window.scrollTo({ top: 0, behavior: "smooth" }); }}
      />
    </>
  );
}
