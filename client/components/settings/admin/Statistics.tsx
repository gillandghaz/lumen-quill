"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/client/lib/api";
import { shortDayLabel } from "@/shared/day";
import { Retention } from "./Retention";

interface Day { day: string; saves: number; newEntries: number; words: number; notes: number }
interface StatsData { users: number; notes: number; entries: number; words: number; activity: Day[]; retention: { statsDays: number } }

export function Statistics() {
  const [d, setD] = useState<StatsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    api<StatsData>("/api/admin/stats").then(setD).catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(load, [load]);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <div className="skeleton tall" />;
  const max = Math.max(1, ...d.activity.map((a) => Math.max(0, a.words)));
  const rows = [...d.activity].reverse();
  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><p className="label">Accounts</p><p className="value">{d.users}</p></div>
        <div className="stat"><p className="label">Notes</p><p className="value">{d.notes}</p></div>
        <div className="stat"><p className="label">Dated entries</p><p className="value">{d.entries}</p></div>
        <div className="stat"><p className="label">Words</p><p className="value">{d.words.toLocaleString("en")}</p></div>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Activity</h2>
          <span className="muted small">last {d.retention.statsDays} {d.retention.statsDays === 1 ? "day" : "days"} · words added per day</span>
        </div>
        <Retention field="statsDays" what="statistics" onChanged={load} />
        {d.activity.length === 0 ? <p className="muted">No activity recorded in this period.</p> : (
          <>
            <div className="bars" role="img" aria-label="Words added per day">
              {d.activity.map((a) => <div key={a.day} className="bar" style={{ height: `${Math.max(3, (Math.max(0, a.words) / max) * 100)}%` }} title={`${shortDayLabel(a.day)}: ${a.words} words`} />)}
            </div>
            <div className={`table-wrap${rows.length > 5 ? " scroll-5" : ""}`}>
              <table className="table">
                <thead><tr><th>Day</th><th>Saves</th><th>New entries</th><th>New notes</th><th>Words</th></tr></thead>
                <tbody>{rows.map((a) => <tr key={a.day}><td>{shortDayLabel(a.day)}</td><td>{a.saves}</td><td>{a.newEntries}</td><td>{a.notes}</td><td>{a.words}</td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
