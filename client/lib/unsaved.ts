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

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (hasPending()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}
