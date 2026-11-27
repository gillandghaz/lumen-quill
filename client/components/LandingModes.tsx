"use client";

import { useState } from "react";
import type { Mode } from "@/shared/limits";
import { applyMode } from "./ModeSwitch";

const MODES: { id: Mode; name: string; tag: string; text: string; colors: string[] }[] = [
  {
    id: "sonata",
    name: "Sonata",
    tag: "Modern · celestial",
    text: "A night sky over a city of light. Ivory type, gold filaments, thin instrument lines and bracketed panels.",
    colors: ["#070912", "#101628", "#e9c983", "#8fdcf2", "#eef1f8"],
  },
  {
    id: "palace",
    name: "Palace",
    tag: "Classic · European court",
    text: "Silver vellum and royal ink. Engraved capitals, gilded double rules and a ruled page to write on.",
    colors: ["#e9e7e1", "#faf9f5", "#8e6d2e", "#5b1f2e", "#1b2140"],
  },
];

export function LandingModes({ initial }: { initial: Mode }) {
  const [mode, setMode] = useState<Mode>(initial);
  return (
    <section id="modes" className="modes" aria-label="Display modes">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className="panel mode-card"
          aria-pressed={mode === m.id}
          onClick={() => {
            setMode(m.id);
            applyMode(m.id);
          }}
        >
          <p className="label">{m.tag}</p>
          <h2>{m.name}</h2>
          <div className="swatch" aria-hidden="true">{m.colors.map((c) => <span key={c} style={{ background: c }} />)}</div>
          <p className="muted" style={{ margin: 0 }}>{m.text}</p>
          <p className="mono faint" style={{ margin: "0.75rem 0 0" }}>{mode === m.id ? "Active" : "Tap to preview"}</p>
        </button>
      ))}
    </section>
  );
}
