import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Persephone",
    short_name: "Persephone",
    description: "Linnea's job cockpit",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0B0E1A",
    theme_color: "#0B0E1A",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
