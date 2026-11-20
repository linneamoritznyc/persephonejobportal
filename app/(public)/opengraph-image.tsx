import { ImageResponse } from "next/og";
import { cubistLiteral } from "@/lib/cubist";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Linnea Moritz";

export default async function OG() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#3a2142"/>${cubistLiteral(7, 1200, 630, 44)}</svg>`;
  let font: ArrayBuffer | null = null;
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Instrument+Serif&text=Linnea%20Moritz")).text();
    const src = css.match(/src: url\((.+?)\)/)?.[1];
    if (src) font = await (await fetch(src)).arrayBuffer();
  } catch {}
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={1200} height={630} style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", left: 60, bottom: 60, background: "#ffffff", color: "#15131a", padding: "18px 34px", borderRadius: 999, fontSize: 84, fontFamily: font ? "Instrument Serif" : "serif" }}>Linnea Moritz</div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Instrument Serif", data: font, style: "normal", weight: 400 }] : [] }
  );
}
