# Riyadh Metro — native mobile requirements

Baseline: 2026-10-25. Product owner: Andrey Ershov.

## Decision and delivery order

Android first, iPhone second. Both are full installed native applications: React Native native views, native SVG graphics and OS APIs. No WebView, PWA, hosted page or browser is used to render the app or calculate trips. Expo is the native build/tooling layer, not the delivery format: Android ships APK/AAB; iOS ships a signed app through TestFlight/App Store. Expo Go is optional developer tooling only.

Keep one shared routing/data module and one shared UI codebase, with small platform adapters. No separate rewrite for iOS. Bundle station data, map geometry, translations and routing so first launch works in airplane mode. Website remains independently deployable.

## Requirements and acceptance criteria

| ID | Requirement | Acceptance criterion |
|---|---|---|
| MOB-001 | Native Android and iOS | Installable APK/AAB and iOS archive; no WebView dependency; no server needed to start or plan a trip. |
| MOB-002 | Existing network fidelity | All 83 stations, six lines, places, interchanges, aliases and Park & Ride metadata imported from the site's source of truth; generated core drift fails CI. |
| MOB-003 | Route calculation | Website/native parity for identical inputs and departure time: legs, station order, transfers, walking and time ranges; same-station and invalid-input cases covered. |
| MOB-004 | Native schematic | Pan, pinch zoom, fit-to-network, station selection, highlighted route; selection reachable through accessible station search as well as map. |
| MOB-005 | Languages | Arabic-first UX, English and all eight existing languages; Arabic/Urdu RTL controls; geometry remains geographically consistent and is never mirrored. Preference survives restart. |
| MOB-006 | Trip details | Estimated travel-time range, transfer count, line, direction, stops, walking segments, tariff and operating-hours warning. No invented live arrivals. Show bus/taxi warning for distant places. |
| MOB-007 | Saved trips | Local favourites and recent trips survive restart; errors are visible; malformed/stale records cannot crash the app. |
| MOB-008 | Location | Explicit user action requests foreground permission only; denial/revocation works; nearest station calculated locally; no location upload or background tracking. |
| MOB-009 | Sharing and links | Native share sheet produces public riyadhmetro.fyi links. Cold/warm custom-scheme links validated. Android App Links and iOS Universal Links need verified-domain files and signing identities before release. |
| MOB-010 | Platform conventions | Android back closes dialogs before leaving; iOS safe areas, gestures and keyboard work; edge-to-edge, cutouts, rotation and process death tested. |
| MOB-011 | Accessibility | TalkBack/VoiceOver, scalable text, labelled controls, minimum 48dp Android / 44pt iOS targets, contrast and non-colour route cues. |
| MOB-012 | Offline and updates | Full first-launch offline test on each OS; versioned bundled dataset and visible freshness; publish data corrections through reviewed app updates initially. No mandatory account or online login. |
| MOB-013 | Privacy and stores | Permission rationale, privacy/support pages, data attribution and unofficial-app disclosure; Play Data Safety and Apple App Privacy match actual behavior. No analytics/ads SDK in the first build. |
| MOB-014 | Release quality | Android physical-device test and signed internal distribution first; iOS simulator plus physical iPhone/TestFlight second; neither native bundle export nor TypeScript passing is treated as device QA. |

## Milestones

1. Foundation: native screens + extracted core + parity tests + reproducible platform bundles.
2. Android alpha: station selection, map gestures, route details, favourites, location, sharing, accessible UI; signed APK tested offline on Andrey's phone.
3. Android beta: full website feature parity (alternative explanations, planned departure, trip/QR cards), store assets, privacy, verified links and device regression suite.
4. iPhone alpha: same core and screens; iOS-specific permissions/RTL/keyboard/VoiceOver QA and TestFlight build.
5. Public release only after separate platform acceptance. Apple signing/distribution needs an Apple developer team; no account creation, paid subscription or store publication is implied by this baseline.

## Architecture and maintenance

`mobile/scripts/extract-core.mjs` generates `mobile/src/core/metro.js` from explicitly bounded non-DOM blocks in `src/riyadh-metro.html`. The generator fails when boundaries change or browser APIs leak in. This is a migration step, not a second manually maintained network. Later extract that module upstream for both website and native imports in a separate parity-tested change.

Native React Native screens consume a platform-independent engine instance. AsyncStorage holds preferences/trips; Expo Location and React Native Share/Linking provide native adapters. The engine has no filesystem, network, browser or React dependencies. Native project files are generated with Expo prebuild; local Gradle/Xcode builds remain possible without EAS hosting.
