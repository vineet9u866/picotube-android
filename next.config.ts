import type { NextConfig } from "next";

/**
 * Single Next.js config that branches on the NEXT_CONFIG_CAPACITOR env var.
 *
 * When NEXT_CONFIG_CAPACITOR=1 is set (used by the GitHub Action that builds
 * the Android APK), we use the static-export settings required by Capacitor.
 * When unset (web dev / server build), we use the standalone-server settings
 * required for the Next.js server.
 *
 * Why a single file? Next.js 16 doesn't accept a `--config` CLI flag for
 * `next build`; it always reads `next.config.ts`. Branching inside the file
 * is the cleanest way to support both build modes from one source tree.
 *
 * Note: when building for Capacitor (output: "export"), the GitHub Action
 * also deletes /src/app/api/* — static export doesn't allow dynamic API
 * routes. The frontend uses client-side fetching via CORS proxy when
 * running inside the APK (see src/lib/api-client.ts).
 */

const isCapacitorBuild = process.env.NEXT_CONFIG_CAPACITOR === "1";

const baseConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Always use unoptimized images — PicoTube loads thumbnails directly
    // from i.ytimg.com, so the Next.js image optimizer isn't needed.
    unoptimized: true,
  },
};

const capacitorConfig: NextConfig = {
  ...baseConfig,
  // Capacitor: produce a static HTML/JS/CSS bundle in `out/` instead of a
  // Node.js server. API routes are stripped (no /api/* routes exist in the
  // static build — the frontend uses client-side fetching via CORS proxy
  // when running inside the APK; see src/lib/api-client.ts).
  output: "export",
  trailingSlash: true,
};

const serverConfig: NextConfig = {
  ...baseConfig,
  // Web/dev: produce a standalone Node.js server in .next/standalone/ that
  // we run with `bun .next/standalone/server.js`. API routes are live.
  output: "standalone",
};

export default isCapacitorBuild ? capacitorConfig : serverConfig;
