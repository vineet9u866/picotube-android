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
 *
 * Android 14 / 15 readiness:
 *   - compileSdk = 35, targetSdk = 34 (set in android/variables.gradle)
 *   - AGP 8.6.0, Gradle 8.9 (set in android/build.gradle + gradle-wrapper.properties)
 *   - MainActivity uses WindowInsetsControllerCompat for edge-to-edge
 *     (Android 15 makes edge-to-edge the default; we're already ready)
 *   - MainActivity uses setAutoEnterEnabled for PIP (Android 14+ API)
 *   - AndroidManifest.xml uses scoped storage (READ_MEDIA_VIDEO for
 *     Android 13+) with legacy permissions capped for older versions
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
    // cleartext=false — block HTTP requests. PicoTube only loads HTTPS
    // URLs (youtube.com, i.ytimg.com, the CORS proxies). The WebView's
    // allowMixedContent below lets the YouTube iframe mix HTTPS page
    // with HTTP thumbnails when YouTube serves them, but the top-level
    // scheme stays HTTPS.
    cleartext: false,
  },
  android: {
    // Allow mixed content so the YouTube iframe (which sometimes falls
    // back to http for thumbnails) doesn't get blocked. The page itself
    // stays HTTPS — only mixed subresources are allowed.
    allowMixedContent: true,
    // Dark background so the splash + app feel native. Matches the
    // dark-mode background in globals.css (--background).
    backgroundColor: "#0a0a0b",
    // WebView debug: enabled so the user can inspect via
    // chrome://inspect on desktop Chrome while the device is connected
    // via USB. Set to false for production.
    webContentsDebuggingEnabled: true,
    // Don't capture the user's input focus on launch — let the WebView
    // request focus only when the user taps a field. Fixes a UX issue
    // where the keyboard would pop up on app start if the search input
    // happened to be focused in the URL hash.
    captureInput: false,
    // Android 15: enable the new default WebView behavior for
    // back-forward cache. Lets the WebView instantly restore the
    // previous page when the user navigates back, instead of
    // re-fetching it.
    disableUserInterfaceOptimizations: false,
  },
  plugins: {
    SplashScreen: {
      // 800ms is the sweet spot: long enough to hide the WebView's
      // initial blank state, short enough to feel responsive.
      launchShowDuration: 800,
      backgroundColor: "#0a0a0b",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      // Splash covers the full screen (status + nav bars). The
      // MainActivity then hides them via WindowInsetsController.
      splashFullScreen: true,
      // Don't use immersive mode (sticky flag) — Android 15 deprecates
      // it. The MainActivity handles system bar visibility via
      // BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE.
      splashImmersive: false,
      // Auto-hide the splash once the WebView finishes loading the
      // first page. Combined with launchShowDuration=800, this ensures
      // the splash never lingers if the page loads quickly.
      autoHide: true,
    },
    // StatusBar plugin: dark theme by default (matches backgroundColor).
    StatusBar: {
      // Default style: dark background + light content.
      style: "LIGHT",
      backgroundColor: "#0a0a0b",
      // Don't overlay — let the WebView use safe-area-insets.
      overlaysWebView: true,
    },
    // App plugin: listen for back button presses so we can navigate
    // back through the in-app views (home → search → watch → home).
    // The frontend subscribes to the backbutton event in picotube-app.tsx
    // and dispatches the right navigation action.
    App: {
      // Default Capacitor behavior: on Android, the back button exits
      // the app when there's no more history. The frontend overrides
      // this via the App plugin's addListener('backButton') API.
    },
  },
};

export default config;
