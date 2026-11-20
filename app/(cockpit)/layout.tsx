import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./cockpit.css";

const cormorant = Cormorant_Garamond({ weight: ["500", "600"], subsets: ["latin"], variable: "--font-cormorant", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Persephone", template: "%s · Persephone" },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Persephone", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/180", icon: "/icons/192" },
};

export const viewport: Viewport = { themeColor: "#0B0E1A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function CockpitRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}` }} />
      </body>
    </html>
  );
}
