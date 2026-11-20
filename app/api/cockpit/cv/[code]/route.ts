import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { cvPdf } from "@/lib/agent/draft";
import { db } from "@/lib/supabase/admin";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const { code } = await params;
  if (!/^[1-6][SC](-en)?$/.test(code)) return NextResponse.json({ error: "Unknown CV" }, { status: 404 });
  const pdf = await cvPdf(db(), code);
  if (!pdf) return NextResponse.json({ error: "Not generated" }, { status: 404 });
  return new NextResponse(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="Linnea-Moritz-CV-${code}.pdf"` } });
}
