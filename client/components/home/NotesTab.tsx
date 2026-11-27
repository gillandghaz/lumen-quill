"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/client/lib/api";
import { dayLabel } from "@/shared/day";
import { PageJump, PageMissing } from "../PageJump";
import { SkeletonRows } from "./OverviewTab";

interface Item { noteId: string; noteTitle: string; day: string; words: number; preview: string; updatedAt: number }
interface Page { items: Item[]; page: number; pages: number; total: number }

const monthOf = (day: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** Notes: every dated entry across all notes, newest first, grouped by month (numbered pages of 20). */
export function NotesTab({ onWrite }: { onWrite: () => void }) {
  const [data, setData] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (page: number) => {
    setBusy(true);
    try {
      setData(await api<Page>(`/api/home/notes?page=${page}`));
      setErr(null);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  function go(page: number) {
    void load(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (err && !data) return <p className="error">{err}</p>;
  if (!data) return <SkeletonRows n={5} />;
  if (data.total === 0) {
    return (
      <div className="panel empty">
        <p className="display">No entries yet</p>
        <p>Every day you write appears here, newest first.</p>
        <button className="btn btn-primary" type="button" onClick={onWrite}>Write today</button>
      </div>
    );
  }

  const beyond = data.page > data.pages;
  let lastMonth = "";
  return (
    <>
      {err && <p className="error" role="alert">{err}</p>}
      {beyond ? (
        <PageMissing page={data.page} pages={data.pages} what="entries" onGo={go} />
      ) : (
        <div className={`timeline${busy ? " is-busy" : ""}`}>
          {data.items.map((it) => {
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
      )}
      {(data.pages > 1 || beyond) && <PageJump page={data.page} pages={data.pages} busy={busy} onGo={go} />}
    </>
  );
}
