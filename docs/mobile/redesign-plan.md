# Riyadh Metro app: full native redesign, work plan for agents

Owner: Andrey (approves designs, builds and anything public). Date: 2026-10-31.
Branch: `feat/android-offline-app`. Each workstream opens its own branch from it and a PR back into it. Never push to `main`; never change the website's look or behaviour.

## Why we are redoing it

The first native build (React Native + Expo, `mobile/`) works offline and its routing matches the site (28 tests, parity check), but the interface is a generic prototype: the map takes 40% of the screen, only interchanges are labelled, labels overlap, dark by default, big Swap/Clear buttons, a footer. The app must look better than the website, not worse: full screen, no browser bar, native gestures.

Keep: Expo/React Native, the generated core (`mobile/src/core/metro.js` from `src/riyadh-metro.html` via `scripts/extract-core.mjs`), the parity tests, the Android CI that publishes a preview APK as the `android-preview` pre-release.
Replace: `App.tsx` and `src/components/MetroMap.tsx` (the old screens can be deleted once the new ones work).

## Product rules (do not break)

- Free, independent, unofficial. No RCRC/Darb logos, no claim of being official. Name in stores: "Riyadh Metro Map (Unofficial)" or similar, Andrey decides.
- No accounts, no ads, no analytics SDK, no personal data. Location only after the user taps, foreground only, never sent anywhere.
- Fully offline from first launch. No network call is needed to show the map or plan a trip.
- The map is the product. Everything else floats over it.
- Arabic first, English second, all 8 site languages (en, ar, ur, hi, bn, tl, ru, fr). RTL mirrors the controls, never the map geography.
- No future features hinted anywhere (buses etc.).
- Data and routing come only from the site source. Never hand-edit generated files; never keep a second copy of stations, lines or places.

## Target design (to be confirmed by mockup, workstream 0)

1. Map screen: map edge to edge, under a transparent status bar. One round menu button at the top (language, saved trips, about). Bottom: a draggable panel that always shows two fields side by side, "From" and "To" (من / إلى), with a swap icon; pulling it up opens search. Above the panel on the side: one location button and one "fit network" button. Pinch and double-tap zoom, no +/- buttons. No footer.
2. Search screen: full screen, opens when a From/To field is tapped or the panel is pulled up. Two fields (From, To), swap icon, results list with station/place, line chips and district; "Use my location" row; recent trips; popular places. Same matching as the site (aliases, old names, Arabic, typo tolerance, all words in any order).
3. Route result: draggable bottom sheet with 3 heights (peek: time range, changes, fare; half: route options as cards; full: step-by-step with line colours, direction, stops count, walks, open-now/closing warning). Route highlighted on the map, rest dimmed. Share button (native share sheet, link `https://riyadhmetro.fyi/#from~to~lang`). Save trip (star).
4. Station tap: small card over the map: name (both scripts), lines, former names, nearby places, buttons "From here" / "To here".
5. About screen: unofficial disclaimer, data credits (RCRC open data, © OpenStreetMap contributors ODbL, Wikipedia), feedback email `callmebackemail@protonmail.com`, version and data date.
6. Theme: light and dark follow the phone. Colours from the site CSS tokens (`--bg #F4F7F8 / #10161C`, `--surface`, `--fg`, `--muted`, line colours from `LINES`). Fonts bundled (Golos Text / Noto Sans Arabic or the closest licensed equivalents), not loaded from the network.

## Map: what "more beautiful than the site" means

- Draw from the site's own geometry and label logic, do not invent coordinates: `RAW` station positions, `L1`..`L6` line orders, `LINES` colours, `drawLines`, `drawStation`, `drawLabel`, `labelLines`/`LABEL_LINES` (multi-line labels), `renderTermini`, `farText`/`farLabels` (labels when zoomed out), water/wadi and district layers, `PLACES` landmarks, `AR_NAMES` for Arabic.
- Every station labelled at normal zoom; at far zoom only interchanges and termini (same rule as the site); district names and landmarks appear as you zoom in (level of detail).
- Labels never overlap; larger type than the site (min 12pt at default zoom), halo for contrast in both themes.
- Interchanges as rings, termini marked, line names on the lines at far zoom.
- Tap targets at least 44pt even when stations are small.
- Smooth 60 fps pan/zoom on a mid-range Android.

## Visual style of the map (reference: Yandex Metro Moscow; take the ideas, never its assets or branding)

- Light and dark themes are equal and follow the phone setting; both get the same care (the Yandex reference screenshot was dark only because the phone was in dark mode).
- Thick, bright line strokes (about 2x the site), small station dots with a contrasting outline, generous spacing.
- Interchanges drawn as one dark rounded shape holding one coloured dot per line, so transfers read at a glance.
- Line number badges (coloured circles 1 to 6, matching the official line numbers) placed on each line, repeated at far zoom.
- Large, clean labels set consistently beside stations, readable at the default zoom without halos crowding the map.
- Small hub symbols for the airport terminals and the Riyadh railway station (SAR), drawn by us.
- The wadi and water as a quiet darker band; district names faint, only when zoomed in.

## Workstreams

Each one: small PR, description of what changed, screenshots for UI, `npm test`, `npm run typecheck`, `npm run check:core` green. Do not merge without Andrey's ok.

| # | Workstream | Output | Depends on |
|---|---|---|---|
| 0 | Design mockup | Done 2026-10-31 (layout approved; search moved to the bottom From/To panel after the Yandex reference). The map style is judged on the first native map build. | none |
| 1 | Map geometry extraction | Extend `scripts/extract-core.mjs` (or a sibling `extract-map.mjs`) to generate `src/core/mapGeometry.json`: station xy, label anchor/side/lines per language, line polylines with offsets, interchange/terminus flags, water, districts, landmarks, legend. Drift check in CI like the core. Unit test: counts match the site (83 stations, 6 lines). | none |
| 2 | Native map renderer | `src/map/MetroMap.tsx` with `react-native-svg` + `react-native-gesture-handler` + `react-native-reanimated`: pan, pinch, double-tap, fit; level-of-detail labels; station hit-testing; route highlight; RTL-safe. Performance check on a real Android. | 1 (can start with current data) |
| 3 | App shell, theme, navigation | New `App.tsx`: full-screen map, search pill, buttons, About screen, theme tokens, bundled fonts, status bar, safe areas, Android back closes overlays first. | 0 |
| 4 | Search | Full-screen search using the core's search functions (same results as the site). Recent and popular, "use my location". | 3 |
| 5 | Route sheet | `@gorhom/bottom-sheet` with 3 heights; options, steps, fares, hours warnings, save, share. Same texts and numbers as the site's route card (parity test on a few trips). | 2, 3 |
| 6 | Station card, location, deep links | Station card; nearest station via `expo-location` (local calc); open `riyadhmetro://` and `https://riyadhmetro.fyi/#a~b~lang` links into a route. | 2, 3 |
| 7 | Languages | All UI strings from the site `I18N`; app-only strings in one table with all 8 languages (native speaker check for Arabic before release). Language choice persists. | 3 |
| 8 | Build and release prep | Keep the preview APK pre-release per push. Later: app icon and splash from the site pin icon, production signing key (Andrey keeps the backup), AAB, Play listing texts AR/EN, privacy and support pages on riyadhmetro.fyi. | any |
| 9 | Device QA | Checklist run on Andrey's Android: offline cold start, gestures, search, routes, location allow/deny, language switch and restart, back button, small and large screens, system font size, dark mode. | 2-7 |

New dependencies (add with `npx expo install` so versions match the Expo SDK, commit `package.json` and `package-lock.json`): `react-native-gesture-handler`, `react-native-reanimated`, `@gorhom/bottom-sheet`, fonts via `expo-font`.

## Definition of done for the Android beta

All workstreams merged; preview APK installs and runs offline on Andrey's phone; QA checklist passes; Andrey approves the look. Then the Play closed test (12+ testers, 14 days) starts. iPhone comes after, with a home-screen widget to pass Apple review guideline 4.2.

## Notes for agents

- The site source is one file: `src/riyadh-metro.html`. Read it before touching map or search; most answers are there.
- CI: `.github/workflows/mobile.yml`. The Android job uses the runner's own SDK (setup-android was removed because it failed). A successful run on this branch replaces the `android-preview` pre-release.
- Write user-facing text plainly; no em dashes in UI or store texts.
