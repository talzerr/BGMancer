import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Prevent Next.js from bundling the native sqlite3 binary — it must run in Node.js only
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      // Steam cover art (library page)
      { protocol: "https", hostname: "cdn.akamai.steamstatic.com" },
      { protocol: "https", hostname: "cdn.cloudflare.steamstatic.com" },
    ],
  },
};

// Makes getCloudflareContext() work during `next dev` by spinning up
// a local miniflare instance with the bindings from wrangler.jsonc.
initOpenNextCloudflareForDev();

export default nextConfig;
