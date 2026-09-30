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
      // Report preview iframe loads the same-origin PDF endpoint.
      "frame-src 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // 'unsafe-eval' is only needed by the dev server (HMR/React refresh). 'unsafe-inline' stays:
      // Next's inline bootstrap scripts would otherwise need a per-request nonce (dynamic rendering).
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
      "connect-src 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        // Document CSP for every page. PDF reports are excluded: a CSP on the PDF response
        // (object-src 'none') makes Chrome refuse to show it in the preview iframe.
        source: "/((?!api/reports/).*)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
      {
        source: "/:path*",
        headers: [
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
    // Server-side PDF reports (lib/pdf/*): keep the renderer and its native-ish deps out of the bundle.
    "@react-pdf/renderer",
  ],
  async rewrites() {
    // Question media and avatars go through Node handlers (session check; GCS + disk fallback).
    // beforeFiles: these run BEFORE public/ is checked, so files on disk under
    // public/uploads/{questions,avatars} are never served statically without a session.
    return {
      beforeFiles: [
        { source: "/uploads/questions/:path*", destination: "/api/media/questions/:path*" },
        { source: "/uploads/avatars/:file", destination: "/api/media/avatars/:file" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
