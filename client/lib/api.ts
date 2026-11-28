"use client";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly data: Record<string, unknown> = {}) {
    super(code);
  }
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Short-lived cache of GET answers (60 s, this tab's memory only) so moving between tabs and menus does not read
 * Firestore again. ANY change (POST / PUT / PATCH / DELETE) empties it, so you never see stale data after an
 * action; signing out reloads the page, which drops it entirely. Pass `fresh: true` to bypass it.
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; data: unknown }>();
export function clearApiCache(): void {
  cache.clear();
}

/**
 * JSON API call (same-origin cookie). 401 sends the user to sign-in.
 * An identical mutation (same method, path and body) that is still running is shared instead of sent again, so a
 * double click can never create, delete or import twice.
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal; keepalive?: boolean; fresh?: boolean } = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET") {
    const hit = cache.get(path);
    if (!init.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;
    const running = inflight.get(`GET ${path}`);
    if (running) return running as Promise<T>;
    const p = send<T>(path, init)
      .then((data) => {
        cache.set(path, { at: Date.now(), data });
        return data;
      })
      .finally(() => inflight.delete(`GET ${path}`));
    inflight.set(`GET ${path}`, p);
    return p;
  }
  cache.clear();
  const key = `${method} ${path} ${init.body === undefined ? "" : JSON.stringify(init.body)}`;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = send<T>(path, init).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function send<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal; keepalive?: boolean }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: init.signal,
      keepalive: init.keepalive,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(0, "network");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401 && data["error"] === "unauthorized") window.location.replace("/login?reason=session");
    throw new ApiError(res.status, typeof data["error"] === "string" ? data["error"] : "generic", data);
  }
  return data as T;
}

const MESSAGES: Record<string, string> = {
  network: "You appear to be offline. Changes will be retried.",
  rate_limited: "Too many requests. Please wait a moment.",
  not_found: "Not found.",
  conflict: "This entry was changed in another tab. Reload to see the latest version.",
  day_locked: "That day is over and locked. Only today's section can be written.",
  too_large: "That is too large.",
  username_taken: "That username is taken.",
  username_reserved: "That username is reserved.",
  username_invalid: "Use 3–24 characters: a–z, 0–9, dot or underscore.",
  username_too_soon: "The username can be changed once every 7 days.",
  weak_password: "Choose a stronger password (at least 12 characters).",
  recent_login_required: "For safety, please sign in again and retry within 10 minutes.",
  email_taken: "An account with that e-mail already exists.",
  confirmation_mismatch: "The confirmation text does not match.",
  unsupported_file: "Only .md and .txt files can be imported.",
  future_day: "A note in these files is dated after today. Fix the date and try again.",
  empty_import: "Nothing to import in those files.",
  note_limit: "Note limit reached.",
  entry_limit: "This note has reached its entry limit.",
  service_unavailable: "The archive is temporarily unavailable. Please try again.",
  forbidden: "You are not allowed to do that.",
  cannot_target_self: "You cannot do that to your own account.",
};

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return MESSAGES[e.code] ?? "Something went wrong. Please try again.";
  return "Something went wrong. Please try again.";
}

/** Trigger a browser download of a same-origin GET endpoint. */
export function downloadFrom(path: string): void {
  const a = document.createElement("a");
  a.href = path;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
