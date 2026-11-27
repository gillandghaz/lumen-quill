"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Numbered pages: ← Prev · Page x of y · Next →.
 * Clicking "Page x" turns it into a number box: Enter goes to that page straight away, Esc or clicking elsewhere
 * cancels. A page past the end is allowed; the list then shows that it does not exist and which page is the last.
 */
export function PageJump({ page, pages, busy, onGo }: { page: number; pages: number; busy: boolean; onGo: (p: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(page));
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) box.current?.select();
  }, [editing]);

  function start() {
    if (busy) return;
    setValue(String(page));
    setEditing(true);
  }

  function submit() {
    const n = Number(value);
    setEditing(false);
    if (Number.isInteger(n) && n >= 1 && n !== page) onGo(n);
  }

  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" className="btn btn-sm btn-ghost" disabled={busy || page <= 1} onClick={() => onGo(Math.min(page - 1, pages))} aria-label="Previous page">← Prev</button>
      {editing ? (
        <form className="page-jump" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="mono faint" htmlFor="page-no">Page</label>
          <input
            ref={box}
            id="page-no"
            className="input page-input"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={value}
            aria-label={`Page number, 1 to ${pages}. Press Enter to go.`}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setEditing(false); } }}
            onBlur={() => setEditing(false)}
          />
          <span className="mono faint">of {pages}</span>
        </form>
      ) : (
        <button type="button" className="page-label mono" disabled={busy} onClick={start} title="Type a page number" aria-label={`Page ${page} of ${pages}. Choose a page`}>
          Page <strong>{page}</strong> of {pages}
        </button>
      )}
      <button type="button" className="btn btn-sm btn-ghost" disabled={busy || page >= pages} onClick={() => onGo(page + 1)} aria-label="Next page">Next →</button>
    </nav>
  );
}

/** Shown in place of the list when a typed page is past the end. */
export function PageMissing({ page, pages, what, onGo }: { page: number; pages: number; what: string; onGo: (p: number) => void }) {
  return (
    <div className="panel empty">
      <p className="display">Page {page} does not exist</p>
      <p>There are no {what} on this page. The last page is <strong>{pages}</strong>.</p>
      <button className="btn" type="button" onClick={() => onGo(pages)}>Go to page {pages}</button>
    </div>
  );
}
