import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js, which is what the
  // Dockerfile runner stage ships to Coolify.
  output: "standalone",

  // The dev server binds 0.0.0.0 and is reached through these hostnames, so
  // they have to be allowed explicitly or Next rejects the cross-origin dev
  // requests. Production is unaffected by this list.
  allowedDevOrigins: ["dev3000.truvibe.dev", "tools.truvibe.dev"],
};

export default nextConfig;
