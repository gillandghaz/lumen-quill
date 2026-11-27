"use client";

import { useEffect } from "react";

const POLL_MS = 60_000;
const MIN_GAP_MS = 10_000;

/**
 * Keeps the session honest: when the server answers 401 (account disabled, session revoked or expired) the user is
 * sent to the sign-in page. Network errors / 5xx never sign anyone out. No polling while the tab is hidden.
 */
export function SessionWatcher() {
  useEffect(() => {
    let stopped = false;
    let last = Date.now();
    async function check() {
      last = Date.now();
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
        if (!stopped && res.status === 401) window.location.replace("/login?reason=session");
      } catch {
        /* offline: try later */
      }
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= MIN_GAP_MS) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
  return null;
}
