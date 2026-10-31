# Riyadh Metro Mobile Redesign Handoff (WS2 to WS7)

## How to Apply This Bundle in the Repository

1. Unzip `riyadh-metro-complete-ws2-ws7.zip` at the repository root (`riyadh-metro/`).
2. Inside `mobile/`, install the required Expo SDK 58 packages:
   ```sh
   cd mobile
   npx expo install react-native-gesture-handler react-native-reanimated @gorhom/bottom-sheet expo-font
   ```
3. Run the verification suite:
   ```sh
   npm run check:core
   npm run check:map
   npm test
   npm run typecheck
   ```

## State of Workstreams

| Workstream | Branch | Status | Files |
|---|---|---|---|
| WS2: Native Map Renderer | `ws/2-map-renderer` | Complete | `mobile/src/map/geometry.ts`, `mobile/src/map/labels.ts`, `mobile/src/map/MapLayers.tsx`, `mobile/src/map/MetroMap.tsx` |
| WS3: App Shell | `ws/3-app-shell` | Complete | `mobile/App.tsx`, `mobile/src/theme.ts`, `mobile/src/ui/MenuSheet.tsx`, `mobile/src/ui/BottomPanel.tsx`, `mobile/babel.config.js` |
| WS4: Search | `ws/4-search` | Complete | `mobile/src/ui/SearchView.tsx` |
| WS5: Route Sheet | `ws/5-route-sheet` | Complete | `mobile/src/ui/RouteSheetContent.tsx`, `mobile/tests/route-parity-ws5.test.mjs` |
| WS6: Station Card, Location, Links | `ws/6-card-location-links` | Complete | `mobile/src/ui/StationCard.tsx`, `mobile/App.tsx` |
| WS7: Languages | `ws/7-languages` | Complete | `mobile/src/i18n.ts` |

## Arabic Strings for Native-Speaker Check (WS7)

Please review the following app-only Arabic strings in `mobile/src/i18n.ts`:
- `menu`: القائمة
- `languageTitle`: اللغة
- `savedTrips`: الرحلات المحفوظة
- `recentTrips`: الرحلات الأخيرة
- `aboutTitle`: حول التطبيق
- `saveTrip`: حفظ الرحلة
- `savedLabel`: محفوظة
- `noSavedTrips`: لا توجد رحلات محفوظة بعد
- `noRecentTrips`: لا توجد رحلات أخيرة بعد
- `useMyLocation`: استخدام موقعي الحالي
- `popularPlaces`: أماكن شائعة
- `fitNetwork`: إظهار كل الشبكة
- `fromHere`: من هنا
- `toHere`: إلى هنا
- `leaveNow`: المغادرة الآن
- `leaveLater`: وقت المغادرة
- `arrivalLabel`: الوصول
- `firstClassLabel`: الدرجة الأولى
- `walking`: مشي
- `towards`: باتجاه
- `stationsCount`: محطات
- `formerNames`: الأسماء السابقة
- `nearbyPlaces`: أماكن قريبة
- `metroClosedWarning`: المترو مغلق الآن. تحقق من أوقات العمل قبل السفر.
- `locationError`: تعذر تحديد موقعك. يمكنك اختيار المحطة يدويا.
- `unofficialDisclaimer`: تطبيق مستقل وغير رسمي لخريطة ومسارات مترو الرياض. يعمل بالكامل دون اتصال بالإنترنت، ولا يجمع أي بيانات شخصية. موقعك الجغرافي يحسب على جهازك فقط عند الطلب.

## What Andrey Should Test on the Phone

1. **Map & Gestures (WS2)**: Pan, pinch zoom around fingers, double-tap zoom, `⤢` Fit Network button, level-of-detail labels (far vs normal vs close zoom), Light and Dark mode.
2. **App Shell & Menu (WS3)**: Transparent status bar, top `☰` menu (Language, Saved Trips, About screen with clickable feedback email), Android hardware Back button closing active sheets/cards first.
3. **Search (WS4)**: Tap From or To to expand search; test typo-tolerant search, former station names, station numbers, "Use my location", recent trips, and popular places.
4. **Route Sheet (WS5)**: Plan a route, compare option cards, expand intermediate stops on a ride leg, test "Leave at" (+15m/+30m/+60m), Share sheet, and Save star.
5. **Station Card & Deep Links (WS6)**: Tap any station on the map to see its bilingual card, line badges, former names, nearby places, and "From here" / "To here" buttons.
