package com.picotube.net;

import android.app.PictureInPictureParams;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.util.Rational;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * PicoTube MainActivity.
 *
 * Crash-safety notes (Android 14 / 15):
 *
 * The previous version had three crashes on real devices:
 *
 *   1. `setPictureInPictureParams()` was called in `onCreate()` on devices
 *      that DON'T support PIP (Android TV, some tablets, some OEM-modified
 *      phones). On those devices `hasSystemFeature(FEATURE_PICTURE_IN_PICTURE)`
 *      returns false and the call throws `IllegalStateException`. We now
 *      check the feature flag first and wrap every PIP call in try/catch.
 *
 *   2. `enterPictureInPictureMode()` was called in `onUserLeaveHint()` on
 *      EVERY Home press, regardless of whether the activity was in a state
 *      where PIP was allowed. On Android 12+ in multi-window mode this
 *      throws. On Android 14+ the recommended path is `setAutoEnterEnabled`
 *      on the `PictureInPictureParams` — the system then handles PIP entry
 *      itself (this method isn't called when auto-enter is enabled).
 *
 *   3. `FLAG_LAYOUT_NO_LIMITS` was set on the window, which lets content
 *      render under the status + nav bars. On Android 14+ this breaks
 *      touch dispatch: taps in the area under the system bars don't reach
 *      the WebView because the WindowManager doesn't include them in the
 *      touchable region. The modern replacement is
 *      `WindowCompat.setDecorFitsSystemWindows(false)` + WindowInsets API,
 *      which we use here. The PicoTube CSS uses `env(safe-area-inset-*)`
 *      to keep content visible.
 *
 * Crash logging: a Thread.setDefaultUncaughtExceptionHandler is installed
 * before super.onCreate() so any early-init crashes are logged to logcat
 * with tag "PicoTube". The user can then run
 *   `adb logcat -s PicoTube:E`
 * to see the stack trace.
 *
 * SDK targeting:
 *   - compileSdk = 35 (build with SDK 35 tools — Android 15 ready)
 *   - targetSdk = 34 (so Android 14 behavior applies; bump to 35 when
 *     ready for Android 15's stricter edge-to-edge enforcement)
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "PicoTube";
    private boolean mPipSupported = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Install a global crash logger BEFORE super.onCreate so any
        // crash during Capacitor bridge init is captured. The handler
        // logs to logcat with tag "PicoTube" so the user can debug with
        // `adb logcat -s PicoTube:E`.
        Thread.UncaughtExceptionHandler defaultHandler =
            Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "Uncaught exception on " + thread.getName(), throwable);
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        super.onCreate(savedInstanceState);

        // Detect PIP support. Some Android 8+ devices (TVs, certain
        // tablets, OEM-modified phones) report false here — calling PIP
        // APIs on those devices throws. We check the feature flag AND
        // wrap every call in try/catch for defense in depth.
        try {
            mPipSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && getPackageManager().hasSystemFeature(
                    PackageManager.FEATURE_PICTURE_IN_PICTURE);
        } catch (Throwable t) {
            mPipSupported = false;
            Log.w(TAG, "Could not query PIP feature", t);
        }

        // Edge-to-edge using the modern WindowInsetsController API.
        // Replaces FLAG_LAYOUT_NO_LIMITS which causes WebView touch
        // dispatch issues on Android 14+.
        try {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(
                    getWindow(), getWindow().getDecorView());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } catch (Throwable t) {
            Log.w(TAG, "Could not enable edge-to-edge", t);
        }

        // On Android 14+ (API 34+), use setAutoEnterEnabled on the
        // PictureInPictureParams. The system then auto-enters PIP when
        // the user swipes home — onUserLeaveHint() is NOT called when
        // auto-enter is enabled.
        //
        // For older versions (API 26-33), we fall back to onUserLeaveHint
        // (below) which calls enterPictureInPictureMode() explicitly.
        if (mPipSupported
            && Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .setAutoEnterEnabled(true)
                    .build();
                setPictureInPictureParams(params);
            } catch (Throwable t) {
                Log.w(TAG, "Could not enable auto-PIP", t);
            }
        }
    }

    @Override
    public void onUserLeaveHint() {
        // For Android <14 (API 26-33), enter PIP when the user presses
        // Home. Android 14+ uses setAutoEnterEnabled (set in onCreate)
        // and doesn't reach this code path.
        //
        // We check all of:
        //   - PIP is supported on this device
        //   - We're not already in PIP mode
        //   - We're on Android 8+ (PIP API exists)
        //   - We're on Android <14 (otherwise auto-enter handles it)
        //
        // The whole body is wrapped in try/catch so any device-specific
        // quirk (e.g. multi-window mode throws) degrades gracefully.
        if (mPipSupported
            && !isInPictureInPictureMode()
            && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .build();
                enterPictureInPictureMode(params);
            } catch (Throwable t) {
                Log.w(TAG, "Could not enter PIP", t);
            }
        }
    }
}
