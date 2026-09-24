# android-patches

Committed Android project overrides that we copy into the generated
`android/` folder at build time. We don't commit the full `android/`
folder to git because `cap add android` regenerates it on first run;
this approach keeps the repo small and the patches version-controlled.

## Files

| File | Destination | Purpose |
|------|-------------|---------|
| `MainActivity.java` | `android/app/src/main/java/com/picotube/net/MainActivity.java` | Crash-safe PIP entry, edge-to-edge via WindowInsetsController (no FLAG_LAYOUT_NO_LIMITS), uncaught exception logger. |
| `AndroidManifest.xml` | `android/app/src/main/AndroidManifest.xml` | Permissions, exported MainActivity (Android 12+ requirement), PIP attributes, scoped storage (Android 13+). |
| `strings.xml` | `android/app/src/main/res/values/strings.xml` | App name = "PicoTube". |
| `variables.gradle` | `android/variables.gradle` | `compileSdk=35`, `targetSdk=34` (Android 14 ready, Android 15 ready when bumped). |

We don't patch the project-level `build.gradle` or `gradle-wrapper.properties`
because Capacitor 6.1.2's defaults (AGP 8.2.1 + Gradle 8.7) work fine with
`compileSdk=35`. Higher AGP versions (8.5+) broke Capacitor 6.1.2's
`capacitor.settings.gradle` `include()` call; we'll revisit when Capacitor 6.2
lands.

## Why we patch instead of committing `android/`

Capacitor's `cap add android` regenerates the project structure on first
run. Committing it would create a 50 MB+ git history churn every time we
sync. Patching via these committed files is small, diff-able, and the
workflow applies them cleanly every build.

## Android 14 / 15 readiness

### Android 14 (API 34) — current target

The app targets Android 14:
  - `targetSdk = 34` (runtime behavior matches Android 14)
  - Uses `setAutoEnterEnabled(true)` on `PictureInPictureParams` for
    auto-PIP on Home press (API 34+).
  - Storage uses `READ_MEDIA_VIDEO` (Android 13+) with
    `READ/WRITE_EXTERNAL_STORAGE` capped to old API levels for
    backward compat.
  - `android:exported="true"` on MainActivity (Android 12+ requirement).

### Android 15 (API 35) — prepared

We already compile with SDK 35 (`compileSdk=35`). To opt in to Android 15
**runtime behavior** when ready, change ONE line in `variables.gradle`:

```diff
ext {
    minSdkVersion = 23
    compileSdkVersion = 35
-   targetSdkVersion = 34
+   targetSdkVersion = 35
```

The MainActivity already uses the modern `WindowCompat.setDecorFitsSystemWindows(false)`
API for edge-to-edge (Android 15's default), and `WindowInsetsControllerCompat`
for system bars (no deprecation warnings on SDK 35).

## Crash-safety features in MainActivity

1. **PIP feature check** — `getPackageManager().hasSystemFeature(FEATURE_PICTURE_IN_PICTURE)`
   is checked before any PIP API call. On devices without PIP (TVs, some
   tablets), the call would throw `IllegalStateException`.

2. **No PIP call in onCreate()** — The previous version called
   `setPictureInPictureParams()` during onCreate, which crashed on
   devices that don't support PIP. We now only set params when we've
   confirmed PIP is supported AND only for Android 14+ (using
   setAutoEnterEnabled, the system handles it).

3. **No FLAG_LAYOUT_NO_LIMITS** — This flag, on Android 14+, breaks
   WebView touch dispatch (taps under the status/nav bars don't reach
   the WebView). Replaced with the modern `WindowInsetsControllerCompat`
   API.

4. **Try/catch on every PIP call** — Even with feature detection, OEM
   quirks can throw. Defense in depth.

5. **Uncaught exception logger** — `Thread.setDefaultUncaughtExceptionHandler`
   logs to logcat with tag "PicoTube". Run
   `adb logcat -s PicoTube:E AndroidRuntime:E` to capture crashes.
