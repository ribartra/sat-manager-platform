import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * sha256 of the <style> sonner inserts at runtime (it cannot take a nonce). Allowed by hash in
 * the page CSP (lib/csp.ts); recomputed on every build so a sonner upgrade cannot silently break toasts.
 * The page Content-Security-Policy itself is set per request, with a nonce, in proxy.ts.
 */
function sonnerStyleHash() {
  const source = readFileSync(path.join(process.cwd(), "node_modules/sonner/dist/index.mjs"), "utf8");
  const literal = source.match(/__insertCSS\(("(?:[^"\\]|\\.)*")\)/)?.[1];
  if (!literal) throw new Error("sonner: inline style not found; update sonnerStyleHash in next.config.ts");
  return createHash("sha256").update(JSON.parse(literal) as string).digest("base64");
}

const nextConfig: NextConfig = {
  env: {
    SONNER_STYLE_HASH: sonnerStyleHash(),
  },
  experimental: {
    proxyClientMaxBodySize: "256mb",
  },
  // Docker image builds can SIGSEGV during Next's embedded tsc under memory pressure.
  // CI/local `npm run typecheck` remains the source of truth.
  typescript: {
    ignoreBuildErrors: process.env.DOCKER_BUILD === "1",
  },
  async headers() {
    return [
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
