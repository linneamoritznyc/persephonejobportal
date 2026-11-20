import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["imapflow", "pdf-lib"],
  images: { unoptimized: true },
};

export default nextConfig;
