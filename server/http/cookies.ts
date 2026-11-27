import { SESSION_TTL_MS, sessionCookieName } from "../config";

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      // A malformed cookie (e.g. "%E0%A4%A") counts as absent: a URIError must not become a 500.
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function sessionSetCookie(production: boolean, value: string): string {
  return [
    `${sessionCookieName(production)}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(production ? ["Secure"] : []),
  ].join("; ");
}

export function sessionClearCookie(production: boolean): string {
  return [`${sessionCookieName(production)}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax", ...(production ? ["Secure"] : [])].join("; ");
}
