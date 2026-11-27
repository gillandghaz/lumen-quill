/**
 * Client IP for rate limiting. On Vercel `x-forwarded-for` is overwritten by the platform (not spoofable);
 * `x-vercel-forwarded-for` comes first because it stays correct behind another proxy. Outside Vercel these
 * headers can be forged by the client, which only affects the per-IP limit of the sign-in endpoint.
 */
export function clientIp(req: Request): string {
  for (const name of ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]) {
    const v = req.headers.get(name);
    const first = v ? (v.split(",")[0] ?? "").trim() : "";
    if (first) return first.slice(0, 64);
  }
  return "unknown";
}
