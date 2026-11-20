import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://persephonejobportal.vercel.app";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/login", "/api"] }], sitemap: `${site}/sitemap.xml` };
}
