import type { NextConfig } from "next";

/**
 * HealthSecure frontend — Next.js UI app (default port 3000).
 *
 * The app has no API routes of its own; every `/api/*` request is rewritten
 * to the backend service. The rewrite is a server-side proxy, so to the
 * browser it stays same-origin — session cookies set by the backend are
 * applied to this origin and sent back on later requests.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
