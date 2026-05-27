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

// Defense-in-depth HTTP response headers applied to every route.
// Deliberately omits Content-Security-Policy — the app relies on inline
// styles (Tailwind v4) and inline scripts (Next.js hydration) that would
// require a nonce-based CSP to keep working. Add CSP behind a separate
// rollout when nonce wiring is in place.
const SECURITY_HEADERS = [
  // Stops the page from being framed by another site (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Disables MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Cross-origin referrers send origin only; same-origin sends the full URL.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down sensor APIs we don't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Force HTTPS at the edge — only meaningful in production.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Helps prevent some cross-origin attacks.
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disables the X-Powered-By: Next.js header — small fingerprint reduction.
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;
