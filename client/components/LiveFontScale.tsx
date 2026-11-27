"use client";

import { useEffect } from "react";
import { useLiveSetting } from "@/client/lib/live-user";

/** Keeps --font-scale on the app shell in step with the latest Preferences change. */
export function LiveFontScale({ server }: { server: number }) {
  const scale = useLiveSetting("fontScale", server);
  useEffect(() => {
    document.querySelector<HTMLElement>(".app-shell")?.style.setProperty("--font-scale", String(scale));
  }, [scale]);
  return null;
}
