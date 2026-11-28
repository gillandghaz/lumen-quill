"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/client/lib/api";
import { SkeletonRows } from "./OverviewTab";
import type { NoteMeta } from "./useWriteToday";

interface Page { items: NoteMeta[]; page: number; pages: number; total: number }

/**
 * Archive: notes in the order they were created (newest first; editing never reshuffles them). Rows show the title
 * and facts only. Numbered pages of 20; any page number can be typed in. A page past the end shows an empty page
 * and says which page is the last one.
 */
export function ArchiveTab({ onWrite }: { onWrite: () => void }) {
  const [data, setData] = useState<Page | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (page: number, search = "") => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      else params.set("page", String(page));
      setData(await api<Page>(`/api/notes?${params}`));
      setErr(null);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  function go(page: number) {
    void load(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const beyond = data !== null && !searching && data.page > data.pages;

  return (
    <>
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const s = q.trim();
          setSearching(Boolean(s));
          void load(1, s);
        }}
      >
        <label className="sr-only" htmlFor="q">Search notes</label>
        <input id="q" className="input" type="search" placeholder="Search titles…" maxLength={100} value={q} onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value === "" && searching) {
            setSearching(false);
            void load(1);
          }
        }} />
        <button className="btn btn-ghost" type="submit">Search</button>
      </form>

      {err && <p className="error" role="alert">{err}</p>}
      {!data ? (
        <SkeletonRows n={6} />
      ) : beyond ? (
        <div className="panel empty">
          <p className="display">Page {data.page} does not exist</p>
          <p>There are no notes here. The last page is <strong>{data.pages}</strong>.</p>
          <button className="btn" type="button" onClick={() => go(data.pages)}>Go to page {data.pages}</button>
        </div>
      ) : data.items.length === 0 ? (
        <div className="panel empty">
          <p className="display">{searching ? "Nothing found" : "The archive is quiet"}</p>
          {!searching && <><p>Begin with today. Everything you write is kept under the date you wrote it.</p><button className="btn btn-primary" type="button" onClick={onWrite}>Write today</button></>}
        </div>
      ) : (
        <div className={`note-list${busy ? " is-busy" : ""}`}>
          {data.items.map((n) => (
            <Link key={n.id} prefetch={false} href={`/notes/${n.id}`} className="note-card">
              <span className="note-title trunc">{n.title}</span>
              <span className="note-meta">created {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {n.entryCount} {n.entryCount === 1 ? "day" : "days"} · {n.words} words</span>
            </Link>
          ))}
        </div>
      )}

      {data && !searching && (data.pages > 1 || beyond) && <PageJump page={data.page} pages={data.pages} busy={busy} onGo={go} />}
    </>
  );
}

/** Prev / next plus a number box to jump to any page. */
function PageJump({ page, pages, busy, onGo }: { page: number; pages: number; busy: boolean; onGo: (p: number) => void }) {
  const [value, setValue] = useState(String(page));
  useEffect(() => setValue(String(page)), [page]);
  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" className="btn btn-sm btn-ghost" disabled={busy || page <= 1} onClick={() => onGo(Math.min(page - 1, pages))}>← Prev</button>
      <form
        className="page-jump"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(value);
          if (Number.isInteger(n) && n >= 1) onGo(n);
          else setValue(String(page));
        }}
      >
        <label className="mono faint" htmlFor="page-no">Page</label>
        <input id="page-no" className="input page-input" inputMode="numeric" pattern="[0-9]*" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-label={`Page number, 1 to ${pages}`} />
        <span className="mono faint">of {pages}</span>
        <button type="submit" className="btn btn-sm btn-ghost" disabled={busy}>Go</button>
      </form>
      <button type="button" className="btn btn-sm btn-ghost" disabled={busy || page >= pages} onClick={() => onGo(page + 1)}>Next →</button>
    </nav>
  );
}
