import { ImageResponse } from "next/og";

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = size === "512" ? 512 : size === "180" ? 180 : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0B0E1A", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", width: s * 0.62, height: s * 0.62, background: "#C2364B", transform: "rotate(18deg)", borderRadius: s * 0.08 }} />
        <div style={{ position: "absolute", width: s * 0.34, height: s * 0.34, background: "#2b3fd1", left: s * 0.18, top: s * 0.2, transform: "rotate(-12deg)" }} />
        <div style={{ position: "absolute", width: s * 0.26, height: s * 0.26, background: "#d9a43c", right: s * 0.17, bottom: s * 0.19, transform: "rotate(30deg)" }} />
        <div style={{ color: "#EEF1F8", fontSize: s * 0.46, fontFamily: "serif", position: "relative" }}>P</div>
      </div>
    ),
    { width: s, height: s }
  );
}
