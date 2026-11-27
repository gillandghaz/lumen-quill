"use client";

import { useMemo, useState } from "react";
import type { PageUser } from "@/server/page-guards";
import { api, errorText } from "@/client/lib/api";
import { applyMode, MODE_LABEL } from "./ModeSwitch";
import type { Mode, NextDayBehavior } from "@/shared/limits";
import { dayKey, dayLabel } from "@/shared/day";

const NEXT: { id: NextDayBehavior; label: string; text: string }[] = [
  { id: "ask", label: "Ask me", text: "On a new day, choose between continuing the latest note or starting a new one." },
  { id: "continue", label: "Always continue", text: "Add today's section to the latest note." },
  { id: "new", label: "Always start new", text: "Every new day begins a separate note." },
];

export function SettingsPanel({ user }: { user: PageUser }) {
  const [s, setS] = useState(user.settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [s.timeZone];
    }
  }, [s.timeZone]);

  async function save(patch: Partial<typeof s>) {
    const next = { ...s, ...patch };
    setS(next);
    if (patch.mode) applyMode(patch.mode);
    if (patch.fontScale) document.querySelector<HTMLElement>("[style*='--font-scale']")?.style.setProperty("--font-scale", String(patch.fontScale));
    try {
      await api("/api/account/settings", { method: "PUT", body: patch });
      setMsg({ ok: true, text: "Saved." });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="label glyph">Settings</p>
          <h1>Preferences</h1>
        </div>
        {msg && <span className={msg.ok ? "success" : "error"} role="status">{msg.text}</span>}
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Mode</h2></div>
          <div className="choice-grid">
            {(["sonata", "palace"] as Mode[]).map((m) => (
              <button key={m} type="button" className="choice" aria-pressed={s.mode === m} style={s.mode === m ? { borderColor: "var(--accent)" } : undefined} onClick={() => void save({ mode: m })}>
                <strong>{MODE_LABEL[m]}</strong>
                <span className="muted">{m === "sonata" ? "Modern and celestial: night sky, ivory light, gold lines." : "Classic European court: silver vellum, royal ink, gilded rules."}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>A new day</h2></div>
          <p className="muted">Writing on the same day always continues your latest note. What happens the next day:</p>
          <div className="choice-grid">
            {NEXT.map((n) => (
              <button key={n.id} type="button" className="choice" aria-pressed={s.nextDay === n.id} style={s.nextDay === n.id ? { borderColor: "var(--accent)" } : undefined} onClick={() => void save({ nextDay: n.id })}>
                <strong>{n.label}</strong>
                <span className="muted">{n.text}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Time zone</h2></div>
          <p className="muted">Decides which date a new entry gets. Today there: <strong>{dayLabel(dayKey(Date.now(), s.timeZone))}</strong>.</p>
          <div className="field">
            <label className="label" htmlFor="tz">Time zone</label>
            <select id="tz" className="select" value={s.timeZone} onChange={(e) => void save({ timeZone: e.target.value })}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Writing size</h2></div>
          <div className="field">
            <label className="label" htmlFor="fs">Text size · {Math.round(s.fontScale * 100)}%</label>
            <input id="fs" type="range" min={0.85} max={1.3} step={0.05} value={s.fontScale} onChange={(e) => setS({ ...s, fontScale: Number(e.target.value) })} onPointerUp={() => void save({ fontScale: s.fontScale })} onKeyUp={() => void save({ fontScale: s.fontScale })} />
          </div>
        </section>
      </div>
    </>
  );
}
