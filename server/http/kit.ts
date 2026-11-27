import type { Deps } from "../deps";
import { HttpError } from "../errors";
import { assertSameOrigin } from "../security/csrf";
import { RULES, type RuleName } from "../security/rate-limit";
import { requireAdmin, requireUser, type CurrentUser } from "../session";
import { errorResponse, readJson } from "./respond";
import { ID_PATTERN, UID_PATTERN } from "@/shared/schemas";
import { getDeps } from "../deps";

export type Handler<P = Record<string, string>> = (req: Request, deps: Deps, params: P) => Promise<Response>;

/** Wraps a handler: every error becomes a generic answer (no internals, no personal data). */
export function safe<P>(h: Handler<P>): Handler<P> {
  return async (req, deps, params) => {
    try {
      return await h(req, deps, params);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Mandatory order for every mutation: same Origin -> signed-in user (or admin) -> rate limit. */
export async function writer(req: Request, deps: Deps, rule: RuleName = "write", admin = false): Promise<CurrentUser> {
  assertSameOrigin(req, deps.config.allowedOrigins);
  const u = admin ? await requireAdmin(req, deps) : await requireUser(req, deps);
  await deps.limiter.hit(rule, u.identity.uid, RULES[rule]);
  return u;
}

export const validId = (id: string | undefined): string => {
  if (!id || !ID_PATTERN.test(id)) throw new HttpError(404, "not_found");
  return id;
};
export const validUid = (uid: string | undefined): string => {
  if (!uid || !UID_PATTERN.test(uid)) throw new HttpError(404, "not_found");
  return uid;
};
export const body = (req: Request, max = 65_536) => readJson(req, max);
export const query = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);

type RouteCtx = { params: Promise<Record<string, string>> };

/** Adapter from a Next.js route handler to our handler signature (dependencies resolved lazily, failing closed). */
export function route(h: Handler) {
  return async (req: Request, ctx?: RouteCtx): Promise<Response> => {
    let deps: Deps;
    try {
      deps = getDeps();
    } catch (e) {
      console.error("deps_unavailable", e instanceof Error ? e.name : "unknown");
      return errorResponse(new HttpError(503, "service_unavailable"));
    }
    const params = ctx ? await ctx.params : {};
    return h(req, deps, params);
  };
}
