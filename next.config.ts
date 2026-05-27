import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Image optimization configuration */
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.example.com",
        port: "",
        pathname: "/**",
      },
    ],
    minimumCacheTTL: 60,
  },

  /* Internationalization (i18n) support */
  // Note: In Next.js 16+ App Router, the `i18n` option in `next.config` is unsupported 
  // and will crash the production build with Pages Router errors.
  // Instead, internationalization is handled dynamically using Middleware (middleware.ts)
  // and routing via the `[locale]` folder structure (e.g. app/[locale]/layout.tsx).
  // 
  // If you ever use a hybrid setup or Pages Router:
  // i18n: {
  //   locales: ["en", "es", "fr"],
  //   defaultLocale: "en",
  // },
};

export default nextConfig;
