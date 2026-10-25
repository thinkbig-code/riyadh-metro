# Riyadh Metro native apps

Android first, iPhone next. React Native native controls and `react-native-svg` render the interface; no WebView/PWA. Expo generates Android/iOS projects and native bundles. All routing data is bundled; no metro backend, sign-in or cloud build service is required.

## Develop

Node 24+, Python is not required for the mobile app. Run from `mobile/`:

```sh
npm ci
npm run generate:core
npm test
npm run typecheck
npm run android
# On macOS with Xcode + CocoaPods:
npm run ios
```

Android needs Android Studio/SDK and a device or emulator. `npm run android` produces a developer build connected to Metro. For a standalone offline Android preview:

```sh
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease
```

The generated template uses the **debug signing key for this preview release**. This APK is for internal testing, not Play Store submission. Output: `android/app/build/outputs/apk/release/app-release.apk`. Production signing keys, app icons and store submission are separate release tasks. iOS physical-device installation needs an Apple signing team; simulator development does not need paid distribution.

## Verify

```sh
npm run check:core
npm test
npm run typecheck
npx playwright install chromium
npm run test:parity
npm run export:native
```

`export:native` builds Android and iOS Hermes JavaScript bundles. It does **not** compile an APK/IPA or validate native OS behaviour. `test:parity` executes the original browser router against the native module for the same frozen departure time. Playwright is a dev-only reference runner, never part of the app.

## What is implemented in this first increment

Native map with pan/pinch/zoom controls and station selection; station/place search and aliases; route alternatives and directions; local favourites/recent trips; OS sharing; foreground nearest-station lookup; persisted language choice; existing eight translations and RTL text/layout; dark palette; custom-scheme link parsing.

Full acceptance scope and delivery gates: [requirements](../docs/mobile/requirements.md). Remaining work includes device QA, complete localisation of new mobile-only labels (currently AR/EN), planned departure UI, trip/QR cards, verified HTTPS app links, production assets/signing and store privacy declarations. Native map gesture ergonomics and accessibility require physical Android and iPhone testing. The first scaffold is not store-ready.

## Data ownership

`src/core/metro.js` is generated from `../src/riyadh-metro.html`. Edit the source or extraction adapter, then regenerate; never hand-edit the generated copy. The generator records a SHA-256 source fingerprint and CI rejects drift. Website files and deploy flows remain independent. Existing repository licence and third-party attribution apply.
