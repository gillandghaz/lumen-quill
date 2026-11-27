import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/client/components/BrandMark";
import { LoginForm } from "@/client/components/LoginForm";
import { loadPageContext } from "@/server/page-guards";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadPageContext();
  if (ctx.configured && ctx.user) redirect("/archive");
  const reason = (await searchParams)["reason"];
  return (
    <>
      <header className="landing-top">
        <Link href="/" className="brand"><BrandMark />Lumen Archive</Link>
      </header>
      <main id="main" className="auth-wrap">
        <div className="panel auth-card">
          <p className="label glyph">Private archive</p>
          <h1>Sign in</h1>
          {!ctx.configured && <p className="error" role="alert">The archive is temporarily unavailable. Please try again later.</p>}
          {reason === "session" && <p className="hint" role="status">Your session ended. Please sign in again.</p>}
          <LoginForm />
          <p className="hint" style={{ marginTop: "1.25rem", marginBottom: 0 }}>There is no public sign-up. Accounts are created by the archive keeper.</p>
        </div>
      </main>
    </>
  );
}
