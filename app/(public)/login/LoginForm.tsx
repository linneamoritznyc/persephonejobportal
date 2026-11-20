"use client";
import { useState } from "react";
import { sendMagicLink } from "./actions";

export default function LoginForm({ error }: { error?: string }) {
  const [state, setState] = useState<{ ok?: boolean; msg?: string }>(error ? { msg: "That link didn't work. Send a new one." } : {});
  const [busy, setBusy] = useState(false);
  return (
    <form
      action={async (fd) => {
        setBusy(true);
        const r = await sendMagicLink(fd);
        setState(r);
        setBusy(false);
      }}
    >
      <label htmlFor="email" className="msg">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      <button type="submit" disabled={busy}>{busy ? "Sending..." : "Send magic link"}</button>
      {state.msg ? <p className="msg" role="status">{state.msg}</p> : null}
    </form>
  );
}
