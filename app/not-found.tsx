import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="auth-wrap">
      <div className="panel auth-card">
        <p className="label glyph">404</p>
        <h1>Not in the archive</h1>
        <p className="muted">This page does not exist, or it is not yours to see.</p>
        <Link className="btn" href="/">Return</Link>
      </div>
    </main>
  );
}
