"use client";

/** Prev / next with "page x of y" (cursor-based paging; the total comes from a cheap count). */
export function Pagination({ page, pages, canPrev, canNext, onPrev, onNext, busy }: {
  page: number;
  pages: number | null;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  busy?: boolean;
}) {
  if (!canPrev && !canNext) return null;
  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" className="btn btn-sm btn-ghost" disabled={!canPrev || busy} onClick={onPrev} aria-label="Previous page">← Prev</button>
      <span className="mono faint">Page {page}{pages ? ` of ${pages}` : ""}</span>
      <button type="button" className="btn btn-sm btn-ghost" disabled={!canNext || busy} onClick={onNext} aria-label="Next page">Next →</button>
    </nav>
  );
}
