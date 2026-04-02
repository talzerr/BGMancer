import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    // Image optimization on Cloudflare requires a paid Cloudflare Images subscription.
    // With unoptimized, images load directly from their source CDNs (Steam, YouTube, Google).
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // HTTPS only — browsers will refuse HTTP for 1 year after first visit
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Prevent MIME-type sniffing (e.g. treating a .txt as .html)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Block this site from being embedded in iframes (clickjacking protection)
          { key: "X-Frame-Options", value: "DENY" },
          // Only send the origin as referrer to external sites, full URL for same-origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser features the app doesn't use
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // CSP: restrict where resources can load from
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires 'unsafe-inline' for styled-jsx and inline styles
              "style-src 'self' 'unsafe-inline'",
              // Next.js injects inline scripts for hydration; YouTube iframe API loaded dynamically
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com",
              // Images: YouTube thumbnails + Steam cover art + Google avatars
              "img-src 'self' data: https://i.ytimg.com https://img.youtube.com https://*.steamstatic.com https://lh3.googleusercontent.com",
              // API calls + YouTube iframe communication
              "connect-src 'self' https://api.anthropic.com https://www.youtube.com",
              // Fonts loaded from same origin
              "font-src 'self'",
              // YouTube embedded player
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
              // No form submissions to external origins
              "form-action 'self'",
              // Only allow this origin as base URI
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// Makes getCloudflareContext() work during `next dev` by spinning up
// a local miniflare instance with the bindings from wrangler.jsonc.
initOpenNextCloudflareForDev();

export default nextConfig;
