import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the PicoTube Android APK.
 *
 * Package ID: com.picotube.net
 *
 * The web assets live in `./out` (the result of `next build` with
 * `output: 'export'`). The APK bundles these — it does NOT load any URL.
 * The user opens the app and immediately sees the home screen.
 *
 * API calls (catalog, search, etc.) go to either the deployed Next.js
 * server (when running on the web) or directly to YouTube via a CORS
 * proxy (when running inside the APK). See `src/lib/api-client.ts`.
 */
const config: CapacitorConfig = {
  appId: "com.picotube.net",
  appName: "PicoTube",
  webDir: "out",
  bundledWebRuntime: false,
  server: {
    // Use the local (bundled) web assets. androidScheme: 'https' makes the
    // WebView behave like a normal HTTPS origin — required for fetch()
    // to work the same way it does on the web.
    androidScheme: "https",
    // Allow inline JS to execute (we use it for the YouTube iframe bridge).
    cleartext: false,
  },
  android: {
    // Allow mixed content so the YouTube iframe (which sometimes falls back
    // to http for thumbnails) doesn't get blocked.
    allowMixedContent: true,
    // Use the WebView's built-in initial scale + dark-mode setting.
    backgroundColor: "#0a0a0b",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0a0a0b",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: false,
    },
  },
};

export default config;
