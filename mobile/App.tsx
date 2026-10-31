import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  Linking,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import BottomSheet from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { getLocales } from "expo-localization";
import { createMetroEngine } from "./src/core/metro";
import { parseRouteLink } from "./src/core/links";
import MetroMap, { MetroMapRef } from "./src/map/MetroMap";
import { getAppStrings } from "./src/i18n";
import {
  directionalRow,
  resolveTheme,
  useSystemThemeMode,
} from "./src/theme";
import BottomPanel from "./src/ui/BottomPanel";
import MenuSheet, { MenuSection, SavedTrip } from "./src/ui/MenuSheet";
import StationCard from "./src/ui/StationCard";

const STORAGE_KEY = "riyadh-metro.preferences.v1";

interface StoredPreferences {
  language: string;
  favourites: SavedTrip[];
  recent: SavedTrip[];
}

function sameTrip(a: SavedTrip, b: SavedTrip): boolean {
  return a.from === b.from && a.to === b.to;
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const themeMode = useSystemThemeMode();

  const [language, setLanguage] = useState<string>(() => {
    const code = getLocales()[0]?.languageCode;
    return code === "ar" ? "ar" : "en";
  });

  const engine = useMemo(() => {
    const e = createMetroEngine();
    const valid = e.languages.some((l) => l.code === language) ? language : "ar";
    e.setLanguage(valid);
    return e;
  }, [language]);

  const rtl = Boolean(
    engine.languages.find((l) => l.code === language)?.rtl,
  );
  const isArabicScript = language === "ar" || language === "ur";
  const theme = useMemo(
    () => resolveTheme(themeMode, false, isArabicScript),
    [isArabicScript, themeMode],
  );
  const s = getAppStrings(language);
  const t = engine.text;

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [activeField, setActiveField] = useState<"from" | "to" | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [sheetIndex, setSheetIndex] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [departOffsetMin, setDepartOffsetMin] = useState<number>(0);

  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [menuSection, setMenuSection] = useState<MenuSection>("language");

  const [favourites, setFavourites] = useState<SavedTrip[]>([]);
  const [recent, setRecent] = useState<SavedTrip[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(false);

  const mapRef = useRef<MetroMapRef>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef<boolean>(true);
  const storageHealthy = useRef<boolean>(true);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
        if (
          parsed.language &&
          engine.languages.some((l) => l.code === parsed.language)
        ) {
          setLanguage(parsed.language);
        }
        const sanitizeTrips = (list: unknown): SavedTrip[] =>
          Array.isArray(list)
            ? list
                .filter(
                  (item): item is SavedTrip =>
                    Boolean(item) &&
                    typeof (item as SavedTrip).from === "string" &&
                    typeof (item as SavedTrip).to === "string" &&
                    Boolean(engine.parseToken((item as SavedTrip).from)) &&
                    Boolean(engine.parseToken((item as SavedTrip).to)),
                )
                .slice(0, 50)
            : [];
        setFavourites(sanitizeTrips(parsed.favourites));
        setRecent(sanitizeTrips(parsed.recent));
      })
      .catch(() => {
        storageHealthy.current = false;
        Alert.alert(s.generalError, s.storageError);
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated || !storageHealthy.current) return;
    const payload = JSON.stringify({ language, favourites, recent });
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, payload))
      .catch(() => {
        if (mounted.current) {
          Alert.alert(s.generalError, s.storageError);
        }
      });
  }, [favourites, hydrated, language, recent, s.generalError, s.storageError]);

  useEffect(() => {
    if (!hydrated) return;
    const handleUrl = (url: string) => {
      const parsed = parseRouteLink(url, engine);
      if (parsed) {
        setFrom(parsed.from);
        setTo(parsed.to);
        setSelectedStationId(null);
        setActiveField(null);
        if (parsed.language) setLanguage(parsed.language);
        bottomSheetRef.current?.snapToIndex(1);
      }
    };
    Linking.getInitialURL()
      .then((url) => {
        if (url) handleUrl(url);
      })
      .catch(() => {});
    const sub = Linking.addEventListener("url", (event) => handleUrl(event.url));
    return () => sub.remove();
  }, [engine, hydrated]);

  const departMs = nowMs + departOffsetMin * 60000;

  const routes = useMemo(
    () => (from && to && from !== to ? engine.plan(from, to, departMs) : []),
    [departMs, engine, from, to],
  );

  useEffect(() => {
    setSelectedOption(0);
  }, [from, to]);

  const activeRoute = useMemo(() => {
    if (!routes.length) return null;
    const r = routes[Math.min(selectedOption, routes.length - 1)];
    const fromSt = engine.parseToken(from)?.st;
    const toSt = engine.parseToken(to)?.st;
    return {
      ...r,
      from: fromSt,
      to: toSt,
    };
  }, [engine, from, routes, selectedOption, to]);

  useEffect(() => {
    if (!hydrated || !from || !to || from === to || !activeRoute) return;
    const trip: SavedTrip = { from, to };
    setRecent((prev) =>
      [trip, ...prev.filter((item) => !sameTrip(item, trip))].slice(0, 8),
    );
  }, [activeRoute, from, hydrated, to]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menuOpen) {
        setMenuOpen(false);
        return true;
      }
      if (activeField) {
        setActiveField(null);
        setSearchQuery("");
        Keyboard.dismiss();
        bottomSheetRef.current?.snapToIndex(from && to ? 1 : 0);
        return true;
      }
      if (selectedStationId) {
        setSelectedStationId(null);
        return true;
      }
      if (sheetIndex > 0) {
        bottomSheetRef.current?.snapToIndex(0);
        return true;
      }
      if (from || to) {
        setFrom("");
        setTo("");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeField, from, menuOpen, selectedStationId, sheetIndex, to]);

  const handleStationPress = useCallback((stationId: string) => {
    Keyboard.dismiss();
    setActiveField(null);
    setSearchQuery("");
    setSelectedStationId((prev) => (prev === stationId ? null : stationId));
  }, []);

  const handleLocate = useCallback(async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(t("locBtn"), s.locationError);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nearest = engine.nearestStation([
        pos.coords.latitude,
        pos.coords.longitude,
      ]);
      if (nearest && mounted.current) {
        if (activeField === "to") {
          setTo(nearest.id);
          setActiveField(null);
          setSearchQuery("");
        } else {
          setFrom(nearest.id);
          if (activeField === "from") {
            setActiveField(to ? null : "to");
            setSearchQuery("");
          }
        }
        setSelectedStationId(nearest.id);
        mapRef.current?.focus([nearest.id]);
        if (nearest.d > 1500) {
          Alert.alert(
            t("locBtn"),
            t("locFar", {
              s: engine.stationName(nearest.id),
              k: (nearest.d / 1000).toFixed(1),
            }),
          );
        }
      }
    } catch {
      Alert.alert(t("locBtn"), s.locationError);
    } finally {
      if (mounted.current) setLocating(false);
    }
  }, [activeField, engine, s.locationError, t, to]);

  const handlePressField = useCallback((field: "from" | "to") => {
    setSelectedStationId(null);
    setActiveField(field);
    setSearchQuery("");
    bottomSheetRef.current?.snapToIndex(2);
  }, []);

  const handleSelectSearchToken = useCallback(
    (token: string) => {
      Keyboard.dismiss();
      setSearchQuery("");
      if (activeField === "from") {
        setFrom(token);
        if (!to) {
          setActiveField("to");
        } else {
          setActiveField(null);
          bottomSheetRef.current?.snapToIndex(1);
        }
      } else {
        setTo(token);
        if (!from) {
          setActiveField("from");
        } else {
          setActiveField(null);
          bottomSheetRef.current?.snapToIndex(1);
        }
      }
    },
    [activeField, from, to],
  );

  const handleSwap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  const handleClear = useCallback(() => {
    Keyboard.dismiss();
    setFrom("");
    setTo("");
    setActiveField(null);
    setSearchQuery("");
    setSelectedStationId(null);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const isCurrentRouteSaved = useMemo(
    () => Boolean(from && to && favourites.some((p) => sameTrip(p, { from, to }))),
    [favourites, from, to],
  );

  const handleToggleSaveRoute = useCallback(() => {
    if (!from || !to) return;
    const trip = { from, to };
    setFavourites((prev) =>
      prev.some((p) => sameTrip(p, trip))
        ? prev.filter((p) => !sameTrip(p, trip))
        : [trip, ...prev].slice(0, 50),
    );
  }, [from, to]);

  const handleShareRoute = useCallback(async () => {
    if (!activeRoute || !from || !to) return;
    try {
      await Share.share({
        message: `${engine.name(from)} → ${engine.name(to)}\n${t("minRange", {
          a: activeRoute.time,
          b: activeRoute.timeMax,
        })} · ${t("changes", { n: activeRoute.xf })}\n${engine.shareUrl(
          from,
          to,
        )}`,
      });
    } catch {
      Alert.alert(s.generalError);
    }
  }, [activeRoute, engine, from, s.generalError, t, to]);

  const { colors } = theme;
  const topBarRow = directionalRow(rtl);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
      />

      <MetroMap
        ref={mapRef}
        theme={theme.mode}
        language={language}
        selected={selectedStationId}
        route={activeRoute}
        onStationPress={handleStationPress}
        bottomInset={160}
        fontRegular={theme.fonts.regular}
        fontBold={theme.fonts.bold}
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.topOverlay,
          topBarRow,
          { top: insets.top + 10 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.menu}
          onPress={() => {
            setMenuSection("language");
            setMenuOpen(true);
          }}
          style={[
            styles.roundButton,
            { backgroundColor: colors.surface, borderColor: colors.rule },
          ]}
        >
          <Text style={[styles.roundButtonIcon, { color: colors.fg }]}>☰</Text>
        </Pressable>
      </View>

      {!selectedStationId && (
        <View
          pointerEvents="box-none"
          style={[
            styles.sideButtonsWrap,
            rtl ? { left: 14 } : { right: 14 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("locBtn")}
            onPress={handleLocate}
            style={[
              styles.roundButton,
              { backgroundColor: colors.surface, borderColor: colors.rule },
            ]}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={[styles.roundButtonIcon, { color: colors.fg }]}>
                ⌖
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={s.fitNetwork}
            onPress={() => mapRef.current?.fitNetwork()}
            style={[
              styles.roundButton,
              { backgroundColor: colors.surface, borderColor: colors.rule },
            ]}
          >
            <Text style={[styles.roundButtonIcon, { color: colors.fg }]}>
              ⤢
            </Text>
          </Pressable>
        </View>
      )}

      <StationCard
        stationId={selectedStationId}
        engine={engine}
        language={language}
        rtl={rtl}
        theme={theme}
        onFromHere={(sid) => {
          setFrom(sid);
          setSelectedStationId(null);
          if (to && to !== sid) {
            bottomSheetRef.current?.snapToIndex(1);
          }
        }}
        onToHere={(sid) => {
          setTo(sid);
          setSelectedStationId(null);
          if (from && from !== sid) {
            bottomSheetRef.current?.snapToIndex(1);
          }
        }}
        onClose={() => setSelectedStationId(null)}
      />

      <BottomPanel
        ref={bottomSheetRef}
        engine={engine}
        language={language}
        rtl={rtl}
        theme={theme}
        from={from}
        to={to}
        routes={routes}
        selectedOption={selectedOption}
        onSelectOption={setSelectedOption}
        activeField={activeField}
        searchQuery={searchQuery}
        onChangeSearchQuery={setSearchQuery}
        onPressField={handlePressField}
        onSelectSearchToken={handleSelectSearchToken}
        onSelectTrip={(trip) => {
          Keyboard.dismiss();
          setFrom(trip.from);
          setTo(trip.to);
          setActiveField(null);
          setSearchQuery("");
          bottomSheetRef.current?.snapToIndex(1);
        }}
        onUseLocation={handleLocate}
        onCloseSearch={() => {
          Keyboard.dismiss();
          setActiveField(null);
          setSearchQuery("");
          bottomSheetRef.current?.snapToIndex(from && to ? 1 : 0);
        }}
        onSwap={handleSwap}
        onClear={handleClear}
        departMs={departMs}
        departOffsetMin={departOffsetMin}
        onChangeDepartOffsetMin={setDepartOffsetMin}
        isCurrentRouteSaved={isCurrentRouteSaved}
        onToggleSaveRoute={handleToggleSaveRoute}
        onShareRoute={handleShareRoute}
        recent={recent}
        onSheetChange={setSheetIndex}
      />

      <MenuSheet
        visible={menuOpen}
        initialSection={menuSection}
        onClose={() => setMenuOpen(false)}
        engine={engine}
        language={language}
        onSelectLanguage={setLanguage}
        favourites={favourites}
        recent={recent}
        onSelectTrip={(trip) => {
          setFrom(trip.from);
          setTo(trip.to);
          setActiveField(null);
          bottomSheetRef.current?.snapToIndex(1);
        }}
        onRemoveFavourite={(trip) =>
          setFavourites((prev) => prev.filter((item) => !sameTrip(item, trip)))
        }
        theme={theme}
        rtl={rtl}
      />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topOverlay: {
    position: "absolute",
    left: 14,
    right: 14,
    justifyContent: "flex-start",
  },
  sideButtonsWrap: {
    position: "absolute",
    bottom: "21%",
    gap: 10,
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  roundButtonIcon: {
    fontSize: 20,
    fontWeight: "600",
  },
});
