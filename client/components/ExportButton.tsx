"use client";

import { useState } from "react";
import { downloadFrom } from "@/client/lib/api";

/**
 * Export is the most expensive call (it reads every note), so a click locks the button for a few seconds:
 * a double click downloads once.
 */
export function ExportButton({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`btn${primary ? " btn-primary" : ""}${href.includes("noteId") ? " btn-sm btn-ghost" : ""}`}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        downloadFrom(href);
        window.setTimeout(() => setBusy(false), 4000);
      }}
    >
      {busy && <span className="spinner" aria-hidden="true" />}
      {label}
    </button>
  );
}
