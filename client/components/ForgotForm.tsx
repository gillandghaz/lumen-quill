"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/client/auth/actions";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) return <p className="success" role="status">If that address belongs to an account, a reset link is on its way. Check your inbox.</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await requestPasswordReset(email);
        setSent(true);
      }}
    >
      <div className="field">
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" className="input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>Send reset link</button>
    </form>
  );
}
