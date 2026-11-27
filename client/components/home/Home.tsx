"use client";

import { useEffect, useState } from "react";
import type { HomeTab } from "@/shared/limits";
import { useLiveSetting, useLiveUser } from "@/client/lib/live-user";
import { OverviewTab } from "./OverviewTab";
import { NotesTab } from "./NotesTab";
import { ArchiveTab } from "./ArchiveTab";
import { useWriteToday } from "./useWriteToday";

const TABS: { id: HomeTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "notes", label: "Notes" },
  { id: "archive", label: "Archive" },
];

export function Home({ username, initialTab, explicitTab }: { username: string; initialTab: HomeTab; explicitTab: boolean }) {
  const openOn = useLiveSetting("homeTab", initialTab);
  const liveName = useLiveUser({ username, avatarVersion: null }).username;
  const startTab = explicitTab ? initialTab : openOn;
  const [tab, setTab] = useState<HomeTab>(startTab);
  const [error, setError] = useState<string | null>(null);
  const w = useWriteToday(setError);

  // Home (profile menu or brand) while already here: back to the tab chosen under Preferences → Open on.
  useEffect(() => {
    const reset = () => {
      setTab(openOn);
      window.history.replaceState(null, "", "/home");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("lq:home", reset);
    return () => window.removeEventListener("lq:home", reset);
  }, [openOn]);

  function select(t: HomeTab) {
    setTab(t);
    window.history.replaceState(null, "", `/home?tab=${t}`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="label glyph">Lumen Quill · {liveName}</p>
          <h1>Home</h1>
        </div>
        <div className="btn-row">
          <button className="btn btn-ghost" type="button" disabled={w.busy} onClick={() => void w.newNote()}>New note</button>
          <button className="btn btn-primary" type="button" disabled={w.busy} onClick={() => void w.write()}>
            {w.busy && <span className="spinner" aria-hidden="true" />}Write today
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Home sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => select(t.id)}>{t.label}</button>
        ))}
        
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div key={tab} className="tab-enter" role="tabpanel">
        {tab === "overview" && <OverviewTab onWrite={() => void w.write()} onOpen={select} />}
        {tab === "notes" && <NotesTab onWrite={() => void w.write()} />}
        {tab === "archive" && <ArchiveTab onWrite={() => void w.write()} />}
      </div>
      {w.dialog}
    </>
  );
}
