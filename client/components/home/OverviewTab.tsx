"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/client/lib/api";
import { dayLabel, shortDayLabel } from "@/shared/day";
import type { HomeTab } from "@/shared/limits";
import type { NoteMeta } from "./useWriteToday";

interface Overview { today: string; writtenToday: boolean; notes: number; words: number; days: number; streak: number; recent: NoteMeta[] }

export function OverviewTab({ onWrite, onOpen }: { onWrite: () => void; onOpen: (t: HomeTab) => void }) {
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<Overview>("/api/home/overview").then(setD).catch((e) => setErr(errorText(e)));
  }, []);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <SkeletonRows n={4} />;
  return (
    <div className="stack">
      <section className="panel today-card">
        <div>
          <p className="label">Today</p>
          <p className="display today-date">{dayLabel(d.today)}</p>
          <p className="muted" style={{ margin: 0 }}>{d.writtenToday ? "You have written today. Carry on whenever you like." : "Nothing written yet today."}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onWrite}>{d.writtenToday ? "Continue writing" : "Write today"}</button>
      </section>

      <div className="stats">
        <div className="stat"><p className="label">Notes</p><p className="value">{d.notes}</p></div>
        <div className="stat"><p className="label">Days written</p><p className="value">{d.days}</p></div>
        <div className="stat"><p className="label">Words</p><p className="value">{d.words.toLocaleString("en")}</p></div>
        <div className="stat"><p className="label">Streak</p><p className="value">{d.streak}<span className="unit"> {d.streak === 1 ? "day" : "days"}</span></p></div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent notes</h2>
          <button type="button" className="link-btn" onClick={() => onOpen("archive")}>Open archive →</button>
        </div>
        {d.recent.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No notes yet. Begin with today.</p>
        ) : (
          <div className="note-list">
            {d.recent.map((n) => (
              <Link key={n.id} href={`/notes/${n.id}`} className="note-row">
                <span className="note-title trunc">{n.title}</span>
                <span className="note-meta">{n.lastDay ? shortDayLabel(n.lastDay) : "empty"} · {n.words} words</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" />)}
    </div>
  );
}
