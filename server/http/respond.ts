import { ZodError } from "zod";
import { HttpError } from "../errors";

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

/** A text file download. `fileName` must already be ASCII-safe. */
export function download(text: string, fileName: string, mime: "text/markdown" | "text/plain" | "application/json"): Response {
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": `${mime}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

/** gRPC / network codes that mean "Firestore is temporarily unavailable" (answered 503, retryable). */
const TRANSIENT = new Set([4, 8, 10, 14, "deadline-exceeded", "resource-exhausted", "aborted", "unavailable", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND"]);

/** Errors reaching the client are always generic; internals and personal data are never logged or returned. */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    const headers: Record<string, string> = {};
    const retry = e.extra?.["retryAfterSec"];
    if (typeof retry === "number") headers["Retry-After"] = String(retry);
    const pub = e.extra?.["public"];
    return json(e.status, pub && typeof pub === "object" ? { error: e.code, ...pub } : { error: e.code }, headers);
  }
  if (e instanceof ZodError) return json(400, { error: "bad_request" });
  const code = (e as { code?: unknown } | null)?.code;
  if ((typeof code === "number" || typeof code === "string") && TRANSIENT.has(code)) {
    console.error("datastore_unavailable", String(code));
    return json(503, { error: "service_unavailable" }, { "Retry-After": "10" });
  }
  console.error("unhandled_error", e instanceof Error ? e.name : "unknown", typeof code === "number" || typeof code === "string" ? String(code) : "");
  return json(500, { error: "internal" });
}

/**
 * Body limit is in BYTES (multibyte text can be ~3x its character count). An oversized declared Content-Length is
 * rejected before the body is read into memory.
 */
export async function readJson(req: Request, maxBytes = 8192): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, "too_large");
  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) throw new HttpError(415, "unsupported_media_type");
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new HttpError(413, "too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_request");
  }
}
