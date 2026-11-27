import { NextResponse, type NextRequest } from "next/server";

/**
 * Strict, per-request nonce CSP for every page (stronger than a host allowlist).
 * - script-src: only scripts carrying this request's nonce, plus what they load ('strict-dynamic'; needed by the
 *   Firebase Auth popup helper). No inline handlers, no eval in production.
 * - connect-src: our own API and the Firebase Auth endpoints only (Firestore is never reached from the browser).
 * - frame-src: the Firebase auth domain (popup/iframe helper) and Google sign-in.
 * Styles allow 'unsafe-inline' because React style attributes cannot carry a nonce; styles cannot run code.
 */
const FIREBASE_AUTH_DOMAIN = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";

export function buildCsp(nonce: string, dev: boolean): string {
  const authDomain = /^[a-z0-9.-]+$/i.test(FIREBASE_AUTH_DOMAIN) ? ` https://${FIREBASE_AUTH_DOMAIN}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com" +
      authDomain + (dev ? " ws: http://localhost:*" : ""),
    `frame-src${authDomain} https://accounts.google.com https://apis.google.com`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
