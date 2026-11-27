"use client";

import { useMemo, useState } from "react";
import type { PageUser } from "@/server/page-guards";
import { api, errorText } from "@/client/lib/api";
import { applyMode } from "../ModeSwitch";
import { updateLiveUser } from "@/client/lib/live-user";
import type { HomeTab, Mode, NextDayBehavior } from "@/shared/limits";
import { dayKey, shortDayLabel } from "@/shared/day";

type Settings = PageUser["settings"];

/** Compact preferences: one row per setting, label on the left, control on the right. Saved instantly. */
export function PreferencesTab({ user }: { user: PageUser }) {
  // Read straight from the live user (SettingsShell): this tab's latest change, else the server's value.
  const s = user.settings;
  const [scaleDraft, setScaleDraft] = useState<number | null>(null); // while the text-size slider moves
  const scale = scaleDraft ?? s.fontScale;
  const commitScale = () => {
    if (scaleDraft === null) return;
    setScaleDraft(null);
    if (scaleDraft !== s.fontScale) void save({ fontScale: scaleDraft });
  };
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [s.timeZone];
    }
  }, [s.timeZone]);

  async function save(patch: Partial<Settings>) {
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, s[k as keyof Settings]])) as Partial<Settings>;
    if (patch.mode) applyMode(patch.mode);
    if (patch.fontScale) document.querySelector<HTMLElement>(".app-shell")?.style.setProperty("--font-scale", String(patch.fontScale));
    updateLiveUser({ settings: patch });
    setStatus({ ok: true, text: "Saving…" });
    try {
      const r = await api<{ settings: Settings }>("/api/account/settings", { method: "PUT", body: patch });
      updateLiveUser({ settings: r.settings });
      setStatus({ ok: true, text: "Saved" });
    } catch (e) {
      updateLiveUser({ settings: before }); // not saved: show the previous value again
      if (before.mode) applyMode(before.mode);
      if (before.fontScale) document.querySelector<HTMLElement>(".app-shell")?.style.setProperty("--font-scale", String(before.fontScale));
      setStatus({ ok: false, text: errorText(e) });
    }
  }

  return (
    <section className="panel prefs">
      <div className="panel-head">
        <h2>Preferences</h2>
        {status && <span className={`save-state${status.ok ? "" : " is-error"}`} role="status">{status.text}</span>}
      </div>

      <Row label="Mode" hint="Sonata: night sky and gold. Palace: silver vellum and royal ink.">
        <Segmented<Mode> value={s.mode} options={[["sonata", "Sonata"], ["palace", "Palace"]]} onChange={(mode) => void save({ mode })} />
      </Row>
      <Row label="Open on" hint="The Home tab you see first.">
        <Segmented<HomeTab> value={s.homeTab} options={[["overview", "Overview"], ["notes", "Notes"], ["archive", "Archive"]]} onChange={(homeTab) => void save({ homeTab })} />
      </Row>
      <Row label="A new day" hint="The same day always continues your latest note.">
        <Segmented<NextDayBehavior> value={s.nextDay} options={[["ask", "Ask"], ["continue", "Continue"], ["new", "New note"]]} onChange={(nextDay) => void save({ nextDay })} />
      </Row>
      <Row label="Time zone" hint={`Today there: ${shortDayLabel(dayKey(Date.now(), s.timeZone))}`}>
        <select className="select select-sm" value={s.timeZone} aria-label="Time zone" onChange={(e) => void save({ timeZone: e.target.value })}>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </Row>
      <Row label="Text size" hint={`${Math.round(scale * 100)}%`}>
        <input type="range" className="range" min={0.85} max={1.3} step={0.05} value={scale} aria-label="Text size"
          onChange={(e) => setScaleDraft(Number(e.target.value))}
          onPointerUp={commitScale}
          onKeyUp={commitScale} />
      </Row>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="pref-row">
      <div className="pref-label">
        <span className="pref-name">{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </div>
      <div className="pref-control">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className="seg" onClick={() => value !== v && onChange(v)}>{label}</button>
      ))}
    </div>
  );
}
