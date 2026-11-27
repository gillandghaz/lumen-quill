"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "@/client/lib/api";
import { RETENTION_DAYS, type RetentionDays } from "@/shared/limits";

type Key = "statsDays" | "auditDays";

/**
 * "Keep data for 1 / 3 / 7 / 30 days" for one kind of data. Older data is deleted right away and then
 * daily by the clean-up job, so Statistics and the Audit log never grow without bound on the Spark plan.
 */
export function Retention({ field, what, onChanged }: { field: Key; what: string; onChanged?: () => void }) {
  const [value, setValue] = useState<RetentionDays | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Record<Key, RetentionDays>>("/api/admin/retention").then((r) => setValue(r[field])).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, [field]);
  return (
    <div className="retention">
      <span className="label">Auto-delete {what} after</span>
      <div className="segmented" role="radiogroup" aria-label={`Keep ${what} for`}>
        {RETENTION_DAYS.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={value === d} className="seg" disabled={busy || value === null}
            onClick={async () => {
              if (value === d) return;
              setBusy(true);
              try {
                const r = await api<Record<Key, RetentionDays> & { purged: Record<string, number> }>("/api/admin/retention", { method: "PUT", body: { [field]: d } });
                setValue(r[field]);
                const removed = field === "statsDays" ? r.purged["activity"] : r.purged["audit"];
                setMsg({ ok: true, text: removed ? `Saved. ${removed} older records removed.` : "Saved." });
                onChanged?.();
              } catch (e) {
                setMsg({ ok: false, text: errorText(e) });
              } finally {
                setBusy(false);
              }
            }}>{d} {d === 1 ? "day" : "days"}</button>
        ))}
      </div>
      {msg && <span className={msg.ok ? "success" : "error"} role="status">{msg.text}</span>}
    </div>
  );
}
