import Link from "next/link";
import { cookies } from "next/headers";
import { BrandMark } from "@/client/components/BrandMark";
import { LandingModes } from "@/client/components/LandingModes";
import { isMode, MODE_COOKIE } from "@/shared/limits";
import { loadPageContext } from "@/server/page-guards";

export default async function Landing() {
  const [ctx, jar] = await Promise.all([loadPageContext(), cookies()]);
  const signedIn = ctx.configured && ctx.user !== null;
  const cm = jar.get(MODE_COOKIE)?.value;
  const mode = ctx.configured && ctx.user ? ctx.user.settings.mode : isMode(cm) ? cm : "sonata";
  return (
    <>
      <header className="landing-top">
        <Link href="/" className="brand"><BrandMark />Lumen Archive</Link>
        <Link className="btn btn-primary" href={signedIn ? "/archive" : "/login"}>{signedIn ? "Open archive" : "Sign in"}</Link>
      </header>

      <main id="main">
        <section className="hero">
          <div>
            <p className="label glyph">A private archive for your days</p>
            <h1>Write today.<br />Keep it forever.</h1>
            <p className="lead">
              Lumen Archive keeps your notes by the day you wrote them. Return the same day and you simply carry on;
              come back tomorrow and choose to continue the story or begin a new one.
            </p>
            <div className="btn-row">
              <Link className="btn btn-primary" href={signedIn ? "/archive" : "/login"}>{signedIn ? "Continue writing" : "Sign in"}</Link>
              <a className="btn btn-ghost" href="#modes">See the two modes</a>
            </div>
            <p className="hint" style={{ marginTop: "1rem" }}>Invitation only. Accounts are created by the archive keeper.</p>
          </div>

          <div className="panel hero-card" aria-label="Example note">
            <p className="label">Journal</p>
            <div className="entry-day"><span className="date">Thursday, 26 November 2026</span></div>
            <p className="sample">The rain stopped before noon. I finally wrote down the plan for the winter project…</p>
            <div className="entry-day"><span className="date">Friday, 27 November 2026</span></div>
            <p className="sample">Continued from yesterday: the first chapter is done.</p>
            <p className="mono faint">2 entries · 31 words · saved</p>
          </div>
        </section>

        <section className="features" aria-label="Features">
          <div className="panel feature"><h3 className="glyph">Dated by design</h3><p>Every day you write becomes its own section. Same day? It continues. A new day? You decide.</p></div>
          <div className="panel feature"><h3 className="glyph">Two modes</h3><p>Sonata for luminous, modern focus. Palace for an engraved, old-world study. Switch at any time.</p></div>
          <div className="panel feature"><h3 className="glyph">Private by default</h3><p>Sign in with Google or a password. Notes are only ever read by the server for you, never by the browser directly.</p></div>
          <div className="panel feature"><h3 className="glyph">Yours to take</h3><p>Export any note, or everything, as light Markdown or plain text. Import them back the same way.</p></div>
        </section>

        <LandingModes initial={mode} />
      </main>

      <footer className="footer">
        <span>© 2026 Lumen Archive</span>
        <span>Sonata · Palace</span>
      </footer>
    </>
  );
}
