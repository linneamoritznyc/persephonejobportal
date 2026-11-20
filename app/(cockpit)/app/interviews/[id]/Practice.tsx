"use client";
import { useState, useTransition } from "react";
import { practice } from "../../actions";

export default function Practice({ applicationId }: { applicationId: string }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const send = (content?: string) =>
    start(async () => {
      const next = content ? [...msgs, { role: "user" as const, content }] : msgs;
      setMsgs(next);
      setText("");
      const r = await practice(applicationId, next);
      if (r.ok) setMsgs([...next, { role: "assistant", content: r.reply }]);
    });
  return (
    <section className="card p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-3"><h2 className="display text-2xl">Practice</h2>{!msgs.length ? <button className="btn btn-primary ml-auto" disabled={pending} onClick={() => send()}>{pending ? "Starting..." : "Start a practice interview"}</button> : null}</div>
      <div className="space-y-2 max-h-[50vh] overflow-auto">
        {msgs.map((m, i) => <p key={i} className={`rounded-xl p-3 text-sm ${m.role === "assistant" ? "raised" : "bg-pom/15 ml-8"}`}>{m.content}</p>)}
      </div>
      {msgs.length ? (
        <form className="flex gap-2" action={() => { if (text) send(text); }}>
          <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Your answer" />
          <button className="btn btn-primary" disabled={pending}>Send</button>
        </form>
      ) : null}
    </section>
  );
}
