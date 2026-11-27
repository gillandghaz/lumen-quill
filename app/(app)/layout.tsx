import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/client/components/BrandMark";
import { AppNav } from "@/client/components/AppNav";
import { SessionWatcher } from "@/client/auth/SessionWatcher";
import { loadPageContext } from "@/server/page-guards";

/** Every page below requires a verified session; the server decides before anything renders. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await loadPageContext();
  if (!ctx.configured) {
    return (
      <main id="main" className="auth-wrap">
        <div className="panel auth-card"><h1>Unavailable</h1><p className="muted">The archive is temporarily unavailable. Please try again shortly.</p></div>
      </main>
    );
  }
  if (!ctx.user) redirect("/login");
  return (
    <div style={{ ["--font-scale" as string]: String(ctx.user.settings.fontScale) }}>
      <SessionWatcher />
      <header className="topbar">
        <Link href="/archive" className="brand"><BrandMark />Lumen Archive</Link>
        <AppNav admin={ctx.user.admin} />
      </header>
      {children}
    </div>
  );
}
