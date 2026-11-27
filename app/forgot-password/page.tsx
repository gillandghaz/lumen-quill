import Link from "next/link";
import { BrandMark } from "@/client/components/BrandMark";
import { ForgotForm } from "@/client/components/ForgotForm";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <>
      <header className="landing-top">
        <Link href="/" className="brand"><BrandMark />Lumen Archive</Link>
      </header>
      <main id="main" className="auth-wrap">
        <div className="panel auth-card">
          <p className="label glyph">Password</p>
          <h1>Reset password</h1>
          <ForgotForm />
          <p className="hint" style={{ marginBottom: 0 }}><Link href="/login">Back to sign in</Link></p>
        </div>
      </main>
    </>
  );
}
