import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./portfolio.css";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-serif", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://persephonejobportal.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Linnea Moritz",
  description: "AI builder in Stockholm. I find the structure in messy problems, build the tool that fixes them, and bring people along to use it.",
  openGraph: { title: "Linnea Moritz", description: "AI builder in Stockholm. I find the structure in messy problems, build the tool that fixes them, and bring people along to use it.", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
