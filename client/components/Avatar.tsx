"use client";

import { useState } from "react";

/**
 * Profile photo, or the themed default: the Lumen Quill emblem (a quill nib inside an orbit) with the user's
 * initial, drawn in the current mode's colours (Sonata: gold on night; Palace: gilt on ivory).
 */
export function Avatar({ uid, version, name, size = 36 }: { uid: string; version: number | null; name: string; size?: number }) {
  const [failedFor, setFailedFor] = useState<number | null>(null);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  if (version && failedFor !== version) {
    return (
      <img className="avatar-img" src={`/api/avatar/${encodeURIComponent(uid)}?v=${version}`} alt="" width={size} height={size} onError={() => setFailedFor(version)} />
    );
  }
  return (
    <svg className="avatar-default" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="20" className="av-bg" />
      <circle cx="20" cy="20" r="16.5" className="av-ring" fill="none" />
      <path d="M20 6.5 L27 20 L20 33.5 L13 20 Z" className="av-nib" fill="none" />
      <text x="20" y="24.6" textAnchor="middle" className="av-letter">{initial}</text>
    </svg>
  );
}
