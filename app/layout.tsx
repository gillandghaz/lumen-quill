import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Cinzel, Cormorant_Garamond, Inter, JetBrains_Mono, Rajdhani } from "next/font/google";
import "@/client/theme/globals.css";
import "@/client/theme/ui.css";
import { isMode, MODE_COOKIE, type Mode } from "@/shared/limits";
import { loadPageContext } from "@/server/page-guards";

// Fonts are self-hosted by Next at build time (no runtime request to Google: CSP font-src 'self').
const inter = Inter({ subsets: ["latin"], style: ["normal", "italic"], variable: "--f-inter", display: "swap" });
const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--f-rajdhani", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-cinzel", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--f-cormorant", display: "swap" });
// Editor face in Palace: upright only, so the live mirror and the transparent textarea on top have identical glyph
// widths (live *italic* is a per-word transform, see ui.css). Read-only views use the real italic face above.
const cormorantUpright = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal"], variable: "--f-cormorant-upright", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Lumen Quill", template: "%s · Lumen Quill" },
  description: "A private archive for your days. Dated notes in two modes: Sonata and Palace.",
  robots: { index: true, follow: false },
};

export const viewport: Viewport = { themeColor: "#070912" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [jar, ctx] = await Promise.all([cookies(), loadPageContext()]);
  const cookieMode = jar.get(MODE_COOKIE)?.value;
  // The mode cookie is written on every change and at sign-in, so it is never older than the (briefly cached)
  // profile; the profile is the fallback when the cookie is missing (e.g. a new browser).
  const mode: Mode = isMode(cookieMode) ? cookieMode : ctx.configured && ctx.user ? ctx.user.settings.mode : "sonata";
  return (
    <html lang="en" data-mode={mode} className={[inter.variable, rajdhani.variable, cinzel.variable, cormorant.variable, cormorantUpright.variable, mono.variable].join(" ")}>
      <body>
        <div className="backdrop" aria-hidden="true" />
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
