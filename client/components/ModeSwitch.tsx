"use client";

import { useState } from "react";
import { MODE_COOKIE, type Mode } from "@/shared/limits";

export const MODE_LABEL: Record<Mode, string> = { sonata: "Sonata", palace: "Palace" };

/** Applies a mode instantly (no reload) and remembers it in a non-sensitive cookie for server rendering. */
export function applyMode(mode: Mode): void {
  document.documentElement.dataset["mode"] = mode;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${MODE_COOKIE}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function ModeSwitch({ initial, persist = false, onChange }: { initial: Mode; persist?: boolean; onChange?: (m: Mode) => void }) {
  const [mode, setMode] = useState<Mode>(initial);
  async function choose(m: Mode) {
    setMode(m);
    applyMode(m);
    onChange?.(m);
    if (persist) {
      await fetch("/api/account/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: m }),
        credentials: "same-origin",
      }).catch(() => undefined);
    }
  }
  return (
    <div className="mode-switch" role="group" aria-label="Display mode">
      {(["sonata", "palace"] as const).map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => void choose(m)}>
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}
