import { HttpError } from "../errors";

/** Every mutation (non GET/HEAD/OPTIONS) must carry an Origin header equal to one of the app's origins. */
export function assertSameOrigin(req: Request, allowedOrigins: string[]): void {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins.includes(origin)) throw new HttpError(403, "forbidden");
  // Defence in depth: browsers send Sec-Fetch-Site; anything but same-origin is refused when present.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") throw new HttpError(403, "forbidden");
}
