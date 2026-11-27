"use client";

import { useState } from "react";
import type { PageUser } from "@/server/page-guards";
import { AccountTab } from "./AccountTab";
import { PreferencesTab } from "./PreferencesTab";
import { DataTab } from "./DataTab";
import { AdminTab } from "./admin/AdminTab";

export type SettingsTab = "account" | "preferences" | "data" | "admin";

export function SettingsShell({ user, initialTab }: { user: PageUser; initialTab: SettingsTab }) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "account", label: "Account" },
    { id: "preferences", label: "Preferences" },
    { id: "data", label: "Data" },
    ...(user.admin ? [{ id: "admin" as const, label: "Admin" }] : []),
  ];
  function select(t: SettingsTab) {
    setTab(t);
    window.history.replaceState(null, "", t === "account" ? "/settings" : `/settings?tab=${t}`);
  }
  return (
    <div className="settings">
      <aside className="side-nav" aria-label="Settings sections">
        <p className="label glyph">Settings</p>
        {tabs.map((t) => (
          <button key={t.id} type="button" className="side-link" aria-current={tab === t.id ? "page" : undefined} onClick={() => select(t.id)}>{t.label}</button>
        ))}
      </aside>
      <div key={tab} className="settings-body tab-enter">
        {tab === "account" && <AccountTab user={user} />}
        {tab === "preferences" && <PreferencesTab user={user} />}
        {tab === "data" && <DataTab />}
        {tab === "admin" && user.admin && <AdminTab selfUid={user.uid} />}
      </div>
    </div>
  );
}
