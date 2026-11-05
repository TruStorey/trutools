import type { NextConfig } from "next";

/**
 * Extra hostnames the dev server is reached through, beyond localhost.
 *
 * `pnpm dev` binds 0.0.0.0, and Next blocks cross-origin requests to dev-only
 * assets unless the origin is listed — so anyone reaching the dev server by a
 * hostname rather than localhost needs theirs here.
 *
 * Read from the environment rather than written in this file, so a public repo
 * does not advertise anyone's dev host. Set it in .env.local, which is
 * gitignored and is loaded before this config is evaluated:
 *
 *   ALLOWED_DEV_ORIGINS=dev.example.com,*.example.com
 *
 * Development only. Next ignores the option in a production build, and the
 * variable is absent in the Docker image anyway.
 */
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js, which is what the
  // Dockerfile runner stage ships to Coolify.
  output: "standalone",

  experimental: {
    // Above MAX_BODY_BYTES in lib/api/body.ts, never below it: past this limit
    // the proxy hands on a truncated body without error, and the cap there is
    // what turns that into a 413 rather than a result computed on half the input.
    proxyClientMaxBodySize: "2mb",
  },

  // Spread, so an unset variable leaves the key absent rather than handing Next
  // an empty list to interpret.
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
