import type { NextConfig } from "next";

/**
 * Baseline security headers for EVERY response (pages, API, static files).
 * Pages additionally get a strict per-request nonce CSP from proxy.ts; this static CSP is the fallback that still
 * locks framing, plugins, <base> and form targets even where the proxy does not run (API, static assets).
 * COOP `same-origin-allow-popups` isolates the window but keeps the Google sign-in popup working.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
];

/** API answers are JSON/text only: nothing in them may ever execute or be cached by shared caches. */
const apiHeaders = [
  { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Client router cache: a page visited in the last 30 s is shown again without a new server render (each render
  // reads the profile). Per tab, in memory only; never shared between users.
  experimental: { staleTimes: { dynamic: 30 } },
  // Old addresses keep working.
  async redirects() {
    return [
      { source: "/archive", destination: "/home?tab=archive", permanent: false },
      { source: "/account", destination: "/settings?tab=account", permanent: false },
      { source: "/data", destination: "/settings?tab=data", permanent: false },
      { source: "/admin", destination: "/settings?tab=admin", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: apiHeaders },
    ];
  },
};

export default nextConfig;
