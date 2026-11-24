"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMode } from "@/app/(cockpit)/app/actions";

export default function ModeSwitch({ mode, compact = false }: { mode: "ai" | "local"; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const opts: ["ai" | "local", string, string][] = [["local", "Lokalt", "Vetlanda med omnejd"], ["ai", "Tech & AI", "Stockholm · US remote"]];
  return (
    <div role="group" aria-label="Läge / Mode" className={`grid grid-cols-2 gap-1 rounded-2xl bg-white/15 p-1 ${pending ? "opacity-70" : ""}`}>
      {opts.map(([m, label, sub]) => (
        <button
          key={m}
          aria-pressed={mode === m}
          onClick={() => start(async () => { await setMode(m); router.refresh(); })}
          className={`rounded-xl px-2 py-1.5 text-left transition-all duration-200 ${mode === m ? "bg-white text-[#4338ca] shadow" : "text-white/85 hover:text-white"}`}
        >
          <span className="block text-sm font-semibold leading-tight">{label}</span>
          {compact ? null : <span className="block text-[10px] leading-tight opacity-75">{sub}</span>}
        </button>
      ))}
    </div>
  );
}
