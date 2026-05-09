/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Keep heavy native/worker deps out of Next bundling/tracing.
    // This avoids `.next/worker-script/node/index.js` runtime crashes on Windows.
    serverComponentsExternalPackages: [
      "@napi-rs/canvas",
      "pdfjs-dist",
      "pdf-parse",
    ],
  },
};

export default nextConfig;
