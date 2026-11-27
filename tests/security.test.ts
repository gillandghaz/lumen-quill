import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "@/server/security/csrf";
import { readCookie, sessionClearCookie, sessionSetCookie } from "@/server/http/cookies";
import { errorResponse, readJson } from "@/server/http/respond";
import { HttpError } from "@/server/errors";
import { MemoryRateStore, RateLimiter } from "@/server/security/rate-limit";
import { loadConfig, sessionCookieName } from "@/server/config";
import { clientIp } from "@/server/security/client-ip";
import { buildCsp } from "../proxy";

const ORIGIN = "https://lumen-quill.vercel.app";
const req = (method: string, headers: Record<string, string> = {}, body?: string) => new Request(`${ORIGIN}/api/x`, { method, headers, body });

describe("CSRF", () => {
  it("allows safe methods without Origin", () => {
    expect(() => assertSameOrigin(req("GET"), [ORIGIN])).not.toThrow();
  });
  it("rejects mutations without or with a foreign Origin", () => {
    expect(() => assertSameOrigin(req("POST"), [ORIGIN])).toThrow(HttpError);
    expect(() => assertSameOrigin(req("POST", { origin: "https://evil.example" }), [ORIGIN])).toThrow(HttpError);
    expect(() => assertSameOrigin(req("DELETE", { origin: "null" }), [ORIGIN])).toThrow(HttpError);
  });
  it("rejects cross-site fetch metadata even with a matching Origin", () => {
    expect(() => assertSameOrigin(req("PUT", { origin: ORIGIN, "sec-fetch-site": "cross-site" }), [ORIGIN])).toThrow(HttpError);
  });
  it("accepts a same-origin mutation", () => {
    expect(() => assertSameOrigin(req("PUT", { origin: ORIGIN, "sec-fetch-site": "same-origin" }), [ORIGIN])).not.toThrow();
  });
});

describe("session cookie", () => {
  it("is HttpOnly, SameSite=Lax and Secure with the __Host- prefix in production", () => {
    const c = sessionSetCookie(true, "abc");
    expect(c).toMatch(/^__Host-la_session=abc;/);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
    expect(c).toContain("Path=/");
    expect(c).not.toMatch(/Domain=/i);
    expect(sessionClearCookie(true)).toContain("Max-Age=0");
  });
  it("treats malformed cookies as absent", () => {
    expect(readCookie(req("GET", { cookie: "la_session=%E0%A4%A" }), "la_session")).toBeNull();
    expect(readCookie(req("GET", { cookie: "a=1; la_session=xyz" }), "la_session")).toBe("xyz");
  });
  it("uses the prefixed name only in production", () => {
    expect(sessionCookieName(true)).toBe("__Host-la_session");
    expect(sessionCookieName(false)).toBe("la_session");
  });
});

describe("request bodies", () => {
  it("rejects an oversized declared Content-Length before reading", async () => {
    await expect(readJson(req("POST", { "content-type": "application/json", "content-length": "99999" }, "{}"), 100)).rejects.toMatchObject({ status: 413 });
  });
  it("counts bytes, not characters", async () => {
    const text = JSON.stringify({ t: "é".repeat(60) }); // 60 chars but 120+ bytes
    await expect(readJson(req("POST", { "content-type": "application/json" }, text), 100)).rejects.toMatchObject({ status: 413 });
  });
  it("requires JSON content type", async () => {
    await expect(readJson(req("POST", { "content-type": "text/plain" }, "{}"))).rejects.toMatchObject({ status: 415 });
  });
  it("rejects invalid JSON with 400", async () => {
    await expect(readJson(req("POST", { "content-type": "application/json" }, "{nope"))).rejects.toMatchObject({ status: 400 });
  });
});

describe("error responses", () => {
  it("never leak internals", async () => {
    const res = errorResponse(new Error("secret stack detail"));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"internal"}');
  });
  it("map transient datastore errors to 503", () => {
    expect(errorResponse(Object.assign(new Error("x"), { code: 14 })).status).toBe(503);
  });
  it("add Retry-After for rate limits", () => {
    const res = errorResponse(new HttpError(429, "rate_limited", { retryAfterSec: 12 }));
    expect(res.headers.get("retry-after")).toBe("12");
  });
});

describe("rate limiter", () => {
  it("blocks after the limit within a window and resets after it", async () => {
    let t = 1_000_000;
    const rl = new RateLimiter(new MemoryRateStore(), "s".repeat(32), () => t);
    const rule = { limit: 3, windowMs: 1000 };
    for (let i = 0; i < 3; i++) await rl.hit("x", "user", rule);
    await expect(rl.hit("x", "user", rule)).rejects.toMatchObject({ status: 429 });
    await rl.hit("x", "other-user", rule); // separate key
    t += 1000;
    await expect(rl.hit("x", "user", rule)).resolves.toBeUndefined();
  });
});

describe("configuration", () => {
  it("fails closed in production without origin and secret", () => {
    expect(() => loadConfig({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow();
    expect(() => loadConfig({ NODE_ENV: "production", APP_ORIGIN: ORIGIN, RATE_LIMIT_SECRET: "short" } as NodeJS.ProcessEnv)).toThrow();
    expect(loadConfig({ NODE_ENV: "production", APP_ORIGIN: `${ORIGIN}/`, RATE_LIMIT_SECRET: "x".repeat(32) } as NodeJS.ProcessEnv).allowedOrigins).toEqual([ORIGIN]);
  });
});

describe("client ip", () => {
  it("prefers the Vercel header and takes the first hop", () => {
    expect(clientIp(req("GET", { "x-vercel-forwarded-for": "1.1.1.1, 2.2.2.2", "x-forwarded-for": "9.9.9.9" }))).toBe("1.1.1.1");
  });
});

describe("content security policy", () => {
  const csp = buildCsp("NONCE123", false);
  it("is nonce-based, with no unsafe-inline / unsafe-eval scripts in production", () => {
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toContain("'nonce-NONCE123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
  });
  it("locks framing, plugins, base and forms", () => {
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'"]) expect(csp).toContain(d);
  });
  it("never allows the browser to reach Firestore", () => {
    expect(csp).not.toContain("firestore.googleapis.com");
  });
});

describe("cron authorisation", async () => {
  const { cronAuthorized } = await import("@/server/services/retention");
  const secret = "c".repeat(40);
  it("requires the exact bearer secret", () => {
    expect(cronAuthorized(req("GET", { authorization: `Bearer ${secret}` }), secret)).toBe(true);
    expect(cronAuthorized(req("GET", { authorization: `Bearer ${secret}x` }), secret)).toBe(false);
    expect(cronAuthorized(req("GET"), secret)).toBe(false);
  });
  it("fails closed when the secret is missing or short", () => {
    expect(cronAuthorized(req("GET", { authorization: "Bearer " }), undefined)).toBe(false);
    expect(cronAuthorized(req("GET", { authorization: "Bearer short" }), "short")).toBe(false);
  });
});
