import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["imapflow", "nodemailer", "pdf-lib"],
  images: { unoptimized: true },
};

export default nextConfig;
