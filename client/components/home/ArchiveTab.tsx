"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/client/lib/api";
import { SkeletonRows } from "./OverviewTab";
import type { NoteMeta } from "./useWriteToday";
import { PageJump, PageMissing } from "../PageJump";

interface Page { items: NoteMeta[]; page: number; pages: number; total: number }

/**
 * Archive: notes in the order they were created (newest first; editing never reshuffles them). Rows show the title
 * and facts only. Numbered pages of 20; click "Page x" to type any page number. A page past the end shows an empty page
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
        <PageMissing page={data.page} pages={data.pages} what="notes" onGo={go} />
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
