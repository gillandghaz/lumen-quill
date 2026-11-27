"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders a dialog straight into <body>. Pages animate in with `transform`, and a transformed ancestor turns
 * `position: fixed` into "fixed to that element", so a dialog opened low on a long page appeared off-screen.
 * Outside that tree it is always centred on the screen. While open, the page behind does not scroll.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);
  return ready ? createPortal(children, document.body) : null;
}
