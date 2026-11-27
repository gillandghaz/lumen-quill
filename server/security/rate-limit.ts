import { createHash } from "node:crypto";
import { HttpError } from "../errors";

export interface RateRule {
  limit: number;
  windowMs: number;
}

/** Shared counter store (serverless instances share nothing in memory). */
export interface RateStore {
  /** Atomically count one hit in a fixed window; returns the count including this hit. */
  hit(id: string, now: number, windowMs: number): Promise<{ count: number; windowStart: number }>;
}

/**
 * Fixed-window rate limiter. Keys are hashed with a server secret, so raw IPs / uids are never stored.
 */
export class RateLimiter {
  constructor(
    private readonly store: RateStore,
    private readonly secret: string,
    private readonly now: () => number,
  ) {}

  async hit(scope: string, key: string, rule: RateRule): Promise<void> {
    const id = createHash("sha256").update(`${this.secret}|${scope}|${key}`).digest("hex");
    const t = this.now();
    const { count, windowStart } = await this.store.hit(id, t, rule.windowMs);
    if (count > rule.limit) {
      throw new HttpError(429, "rate_limited", { retryAfterSec: Math.max(1, Math.ceil((windowStart + rule.windowMs - t) / 1000)) });
    }
  }
}

export const RULES = {
  session: { limit: 20, windowMs: 10 * 60_000 },
  /** Autosave writes; generous because the editor saves while typing (debounced). */
  save: { limit: 600, windowMs: 10 * 60_000 },
  write: { limit: 120, windowMs: 10 * 60_000 },
  account: { limit: 10, windowMs: 60 * 60_000 },
  search: { limit: 120, windowMs: 10 * 60_000 },
  export: { limit: 60, windowMs: 10 * 60_000 },
  /** Import chunks (≤ 50 notes each): 400 per hour ≈ 20,000 notes, more than the daily Firestore write quota. */
  import: { limit: 400, windowMs: 60 * 60_000 },
  destructive: { limit: 10, windowMs: 60 * 60_000 },
  adminChange: { limit: 60, windowMs: 10 * 60_000 },
  backup: { limit: 300, windowMs: 10 * 60_000 },
} satisfies Record<string, RateRule>;

export type RuleName = keyof typeof RULES;

/** In-memory store (tests and local development only). */
export class MemoryRateStore implements RateStore {
  private readonly m = new Map<string, { count: number; windowStart: number }>();
  async hit(id: string, now: number, windowMs: number) {
    const cur = this.m.get(id);
    const next = !cur || now - cur.windowStart >= windowMs ? { count: 1, windowStart: now } : { count: cur.count + 1, windowStart: cur.windowStart };
    this.m.set(id, next);
    return next;
  }
}
