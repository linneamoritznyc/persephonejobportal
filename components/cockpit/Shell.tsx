"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/app", label: "Today", sub: "Throne", icon: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/app/jobs", label: "Jobs", sub: "Court", icon: "M4 7h16v12H4zM9 7V5h6v2" },
  { href: "/app/applications", label: "Applications", sub: "Harvest", icon: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z" },
  { href: "/app/me", label: "Me", sub: "Mirror", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0" },
  { href: "/app/discover", label: "Discover", sub: "Oracle", icon: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" },
  { href: "/app/agent", label: "Agent", sub: "Runs", icon: "M5 12h14M12 5l7 7-7 7" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function Shell({ children, banner }: { children: React.ReactNode; banner?: React.ReactNode }) {
  const path = usePathname();
  const active = (h: string) => (h === "/app" ? path === "/app" : path.startsWith(h));
  return (
    <div className="min-h-dvh">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-surface/60 px-4 py-6">
        <Link href="/app" className="display text-2xl text-ink px-3">Persephone</Link>
        <p className="px-3 text-xs text-muted mt-1">Two worlds: tech and art</p>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${active(n.href) ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}>
              <Icon d={n.icon} />
              <span>{n.label}</span>
              <span className="ml-auto text-[11px] text-muted/70">{n.sub}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-3 text-xs text-muted space-y-2">
          <a href="/" className="block hover:text-ink">Public portfolio</a>
          <form action="/auth/signout" method="post"><button className="hover:text-ink">Sign out</button></form>
        </div>
      </aside>
      <main className="md:pl-60 pb-24 md:pb-10">
        {banner}
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-6 md:py-10">{children}</div>
      </main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-line bg-night/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-5">
          {NAV.slice(0, 5).map((n) => (
            <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active(n.href) ? "text-pom" : "text-muted"}`}>
              <Icon d={n.icon} />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
