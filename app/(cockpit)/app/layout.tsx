import Shell from "@/components/cockpit/Shell";
import { requireOwner } from "@/lib/auth";
import { draftsConfigured } from "@/lib/mail/imapDraft";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireOwner();
  } catch {
    redirect("/login");
  }
  const banner = draftsConfigured() ? null : (
    <div className="border-b border-pom/40 bg-pom/15 px-4 py-2.5 text-center text-sm text-ink">Add GMAIL_DRAFTS_APP_PASSWORD in Vercel to turn on drafts</div>
  );
  return <Shell banner={banner}>{children}</Shell>;
}
