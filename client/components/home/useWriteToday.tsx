"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorText } from "@/client/lib/api";
import { shortDayLabel } from "@/shared/day";
import type { NextDayBehavior } from "@/shared/limits";

export interface NoteMeta {
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

/**
 * "Write today": same day → continue the latest note; a later day → follow the user's setting
 * (ask by default: continue the latest note with a new dated section, or start a separate note).
 */
export function useWriteToday(onError: (msg: string) => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<Target | null>(null);

  async function newNote() {
    setBusy(true);
    try {
      const n = await api<NoteMeta>("/api/notes", { method: "POST", body: {} });
      router.push(`/notes/${n.id}`);
    } catch (e) {
      onError(errorText(e));
      setBusy(false);
    }
  }

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
      onError(errorText(e));
      setBusy(false);
    }
  }

  const dialog = ask && ask.latest ? (
    <div className="modal-backdrop" role="presentation" onClick={() => setAsk(null)}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-labelledby="ask-title" onClick={(e) => e.stopPropagation()}>
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
        <p className="hint" style={{ margin: "1rem 0 0" }}>You can make this automatic in Settings → Preferences.</p>
      </div>
    </div>
  ) : null;

  return { write, newNote, busy, dialog };
}
