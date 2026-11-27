"use client";

import { useState } from "react";
import { Accounts } from "./Accounts";
import { Statistics } from "./Statistics";
import { Security } from "./Security";
import { AuditLog } from "./AuditLog";
import { Backup } from "./Backup";

type Sub = "accounts" | "statistics" | "security" | "audit" | "backup";
const SUBS: { id: Sub; label: string }[] = [
  { id: "accounts", label: "Accounts" },
  { id: "statistics", label: "Statistics" },
  { id: "security", label: "Security" },
  { id: "audit", label: "Audit log" },
  { id: "backup", label: "Backup" },
];

export function AdminTab({ selfUid }: { selfUid: string }) {
  const [sub, setSub] = useState<Sub>("accounts");
  return (
    <>
      <div className="tabs tabs-sm" role="tablist" aria-label="Admin sections">
        {SUBS.map((s) => (
          <button key={s.id} type="button" role="tab" className="tab" aria-selected={sub === s.id} onClick={() => setSub(s.id)}>{s.label}</button>
        ))}
      </div>
      <div key={sub} className="tab-enter">
        {sub === "accounts" && <Accounts selfUid={selfUid} />}
        {sub === "statistics" && <Statistics />}
        {sub === "security" && <Security />}
        {sub === "audit" && <AuditLog />}
        {sub === "backup" && <Backup />}
      </div>
    </>
  );
}

export const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never");
