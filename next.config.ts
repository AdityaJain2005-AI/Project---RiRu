import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone mode bundles all runtime dependencies using
  // @vercel/nft import tracing — no node_modules needed at runtime.
  output: "standalone",
  transpilePackages: ["@riru/shared"],
  outputFileTracingIncludes: {
    "/api/v1/ingredients/scan": ["./data/ingredients/**/*", "./data/rules/**/*"],
    "/api/v1/ingredients/scans/[id]": ["./data/ingredients/**/*", "./data/rules/**/*"],
    "/api/v1/ingredients/analyze": ["./data/ingredients/**/*", "./data/rules/**/*"],
    "/api/v1/ingredients/[inci]": ["./data/ingredients/**/*", "./data/rules/**/*"],
    "/api/v1/recommendations": [
      "./data/ingredients/**/*",
      "./data/rules/**/*",
      "./data/products/**/*",
      "./data/routines/**/*",
    ],
    "/api/v1/recommendations/[id]": [
      "./data/ingredients/**/*",
      "./data/rules/**/*",
      "./data/products/**/*",
      "./data/routines/**/*",
    ],
    "/api/v1/products/search": [
      "./data/ingredients/**/*",
      "./data/rules/**/*",
      "./data/products/**/*",
      "./data/routines/**/*",
    ],
    "/api/v1/products/[id]/prices": [
      "./data/ingredients/**/*",
      "./data/rules/**/*",
      "./data/products/**/*",
      "./data/routines/**/*",
    ],
    "/api/v1/products/[id]/alternatives": [
      "./data/ingredients/**/*",
      "./data/rules/**/*",
      "./data/products/**/*",
      "./data/routines/**/*",
    ],
    "/api/chat": ["./data/knowledge/**/*", "./data/ingredients/**/*", "./data/rules/**/*"],
    "/api/v1/profile/recovery-mode": ["./data/routines/**/*"],
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
    ];
    // Next hydration still emits inline scripts, so this is not a strict CSP.
    // Dev is left unset so the hot-reload client can connect.
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "img-src 'self' blob: data:",
          "media-src 'self' blob:",
          "connect-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      });
    }
    return [{ source: "/:path*", headers }];
  },
}

export default nextConfig
