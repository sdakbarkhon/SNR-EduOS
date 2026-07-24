# Expo HAS CHANGED

This app is pinned to Expo SDK ~54.0.35 (see package.json) — NOT v56 (that's apps/mobile, a
different, frozen app in this monorepo, which is the actual v56 project). Read the exact
versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

**Why 54 specifically:** Google Play / App Store currently host Expo Go 54.x only (SDK 55+
distributed via GitHub-APK / TestFlight via `eas go`, not stores). runtimeVersion is a
single top-level string `"exposdk:54.0.0"` (both platforms) — Expo Go 54 sends
`expo-runtime-version: exposdk:54.0.0` and fetches our preview channel via QR. No new
native modules allowed — anything outside Expo Go 54's built-in set breaks the workflow.
