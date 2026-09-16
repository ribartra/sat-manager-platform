import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "256mb",
  },
  // Docker image builds can SIGSEGV during Next's embedded tsc under memory pressure.
  // CI/local `npm run typecheck` remains the source of truth.
  typescript: {
    ignoreBuildErrors: process.env.DOCKER_BUILD === "1",
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "connect-src 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@prisma/client",
    "bcryptjs",
    "@google-cloud/storage",
  ],
  async rewrites() {
    // Serve question media via Node handler (GCS + disk fallback). Public/ still
    // wins when a file exists on disk; GCS-only objects hit this route.
    return [
      {
        source: "/uploads/questions/:path*",
        destination: "/api/media/questions/:path*",
      },
    ];
  },
};

export default nextConfig;
