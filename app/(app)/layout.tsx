import { redirect } from "next/navigation";
import { BrandLink } from "@/client/components/BrandLink";
import { ProfileMenu } from "@/client/components/ProfileMenu";
import { SessionWatcher } from "@/client/auth/SessionWatcher";
import { loadPageContext } from "@/server/page-guards";

/**
 * Every page below requires a verified session; the server decides before anything renders.
 * The top bar lives here (not in the pages), so it stays put while you move between Home, notes and Settings.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await loadPageContext();
  if (!ctx.configured) {
    return (
      <main id="main" className="auth-wrap">
        <div className="panel auth-card"><h1>Unavailable</h1><p className="muted">Lumen Quill is temporarily unavailable. Please try again shortly.</p></div>
      </main>
    );
  }
  if (!ctx.user) redirect("/login");
  const u = ctx.user;
  return (
    <div className="app-shell" style={{ ["--font-scale" as string]: String(u.settings.fontScale) }}>
      <SessionWatcher />
      <header className="topbar">
        <BrandLink href="/home" />
        <ProfileMenu user={{ uid: u.uid, username: u.username, email: u.email, admin: u.admin, avatarVersion: u.avatarVersion }} />
      </header>
      {children}
    </div>
  );
}
