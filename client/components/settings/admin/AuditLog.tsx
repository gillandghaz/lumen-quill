"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/client/lib/api";
import { Retention } from "./Retention";
import { when } from "./AdminTab";

interface AuditItem { id: string; action: string; actorUid: string | null; targetUid: string | null; at: number; details: Record<string, unknown> }

export function AuditLog() {
  const [items, setItems] = useState<AuditItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async (c?: string) => {
    try {
      const r = await api<{ items: AuditItem[]; nextCursor: string | null }>(`/api/admin/audit${c ? `?cursor=${c}` : ""}`);
      setItems((prev) => (c ? [...(prev ?? []), ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e) {
      setErr(errorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Audit log</h2><span className="muted small">sign-ins and admin actions · ids and codes only</span></div>
      <Retention field="auditDays" what="audit entries" onChanged={() => void load()} />
      {err && <p className="error">{err}</p>}
      {!items ? <div className="skeleton tall" /> : items.length === 0 ? <p className="muted">No entries in this period.</p> : (
        <div className={`table-wrap${items.length > 8 ? " scroll-8" : ""}`}>
          <table className="table">
            <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="muted small nowrap">{when(a.at)}</td>
                  <td className="mono small">{a.action}</td>
                  <td className="mono faint small">{a.actorUid ? a.actorUid.slice(0, 8) : "-"}</td>
                  <td className="mono faint small">{a.targetUid ? a.targetUid.slice(0, 8) : "-"}</td>
                  <td className="mono faint small">{Object.entries(a.details).filter(([, v]) => v !== "").map(([k, v]) => `${k}=${String(v)}`).join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && <button className="btn btn-ghost btn-sm" style={{ marginTop: "0.75rem" }} type="button" onClick={() => void load(cursor)}>Load older</button>}
    </section>
  );
}
