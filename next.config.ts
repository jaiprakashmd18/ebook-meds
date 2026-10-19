import type { NextConfig } from "next";

function supabaseImageHost(): { protocol: "https" | "http"; hostname: string; port?: string } | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol === "http:" ? "http" : "https",
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
    };
  } catch {
    return null;
  }
}

const supabaseHost = supabaseImageHost();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // The app is personalised per request (Supabase session cookies), so it uses
  // the request-time rendering model rather than Cache Components.
  cacheComponents: false,
  poweredByHeader: false,
  experimental: {
    // Cover and inline image uploads go through server actions (max 5 MB each).
    // Large PDFs are uploaded directly to Storage with signed URLs instead.
    serverActions: { bodySizeLimit: "6mb" },
  },
  serverExternalPackages: ["@react-pdf/renderer", "pdf-lib"],
  // Fonts used by the server-side PDF generator are read from disk.
  outputFileTracingIncludes: {
    "/**": ["./assets/fonts/**/*"],
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ ...supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
