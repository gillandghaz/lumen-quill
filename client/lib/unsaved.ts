"use client";

/**
 * Tracks editors that are still saving or have unsaved text.
 * - Closing / reloading the tab: the browser's own "Leave site?" dialog (beforeunload).
 * - In-app navigation (menu, links): the browser's own confirm() dialog via `confirmLeave()`.
 */
const pending = new Set<string>();

export function setPending(id: string, isPending: boolean): void {
  if (isPending) pending.add(id);
  else pending.delete(id);
}

export function hasPending(): boolean {
  return pending.size > 0;
}

export function confirmLeave(): boolean {
  return !hasPending() || window.confirm("Your note is still being saved. Leave this page anyway? Changes may be lost.");
}

/**
 * Go to Home on the user's "Open on" tab. Already on /home: tell the Home page to reset (same route, so no reload).
 * Elsewhere: a fresh server render of /home picks the saved tab.
 */
export function goHome(router: { push: (href: string) => void; refresh: () => void }): void {
  if (!confirmLeave()) return;
  if (window.location.pathname === "/home") window.dispatchEvent(new Event("lq:home"));
  else {
    router.push("/home");
    router.refresh();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (hasPending()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}
