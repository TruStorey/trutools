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

  // Spread, so an unset variable leaves the key absent rather than handing Next
  // an empty list to interpret.
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
