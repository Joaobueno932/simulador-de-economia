import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Puppeteer só é carregado no runtime Node da rota de PDF; mantê-lo fora do bundle.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
