import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Share,
  Linking,
  Alert,
  useColorScheme,
  BackHandler,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { getLocales } from "expo-localization";
import { createMetroEngine } from "./src/core/metro";
import MetroMap, { lineColors } from "./src/components/MetroMap";
import { parseRouteLink } from "./src/core/links";

type Trip = { from: string; to: string };
type Preferences = { language: string; favourites: Trip[]; recent: Trip[] };
const KEY = "riyadh-metro.preferences.v1";
const EXTRA: Record<string, Record<string, string>> = {
  ar: {
    map: "الخريطة",
    saved: "المحفوظة",
    recent: "الأخيرة",
    save: "حفظ الرحلة",
    unsave: "إلغاء الحفظ",
    empty: "لا توجد رحلات محفوظة",
    offline: "الخريطة والمسارات تعمل دون إنترنت",
    error: "تعذّر إتمام العملية",
    storage: "تعذّر حفظ تفضيلاتك على الجهاز.",
    location: "تعذّر تحديد موقعك. يمكنك اختيار المحطة يدويًا.",
    privacy:
      "تطبيق مستقل وغير رسمي. الموقع محفوظ على جهازك فقط. الأوقات تقديرية.",
    closed: "المترو مغلق الآن — تحقق من مواعيد التشغيل قبل السفر.",
    walk: "المشي",
    towards: "باتجاه",
    choose: "اختر محطة",
    stops: "المحطات",
    loading: "جارٍ تحديد الموقع…",
  },
  en: {
    map: "Map",
    saved: "Saved",
    recent: "Recent",
    save: "Save trip",
    unsave: "Unsave trip",
    empty: "No saved trips yet",
    offline: "Map and routes work offline",
    error: "Could not complete the action",
    storage: "Could not save your preferences on this device.",
    location: "Could not find your location. You can still choose a station.",
    privacy:
      "Independent, unofficial app. Location stays on your device. Travel times are estimates.",
    closed: "Metro is closed now. Check operating hours before travelling.",
    walk: "Walking",
    towards: "Towards",
    choose: "Choose a station",
    stops: "Stations",
    loading: "Finding your location…",
  },
};
const same = (a: Trip, b: Trip) => a.from === b.from && a.to === b.to;
function Main() {
  const [language, setLanguage] = useState(() =>
    getLocales()[0]?.languageCode === "ar" ? "ar" : "en",
  );
  const engine = useMemo(() => {
    const e = createMetroEngine();
    e.setLanguage(
      e.languages.some((l) => l.code === language) ? language : "ar",
    );
    return e;
  }, [language]);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [picker, setPicker] = useState<"from" | "to" | null>(null),
    [query, setQuery] = useState("");
  const [tab, setTab] = useState<"map" | "saved">("map"),
    [languages, setLanguages] = useState(false),
    [option, setOption] = useState(0);
  const [favourites, setFavourites] = useState<Trip[]>([]),
    [recent, setRecent] = useState<Trip[]>([]),
    [hydrated, setHydrated] = useState(false),
    [locating, setLocating] = useState(false),
    [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState<number | null>(null);
  const writeQueue = useRef(Promise.resolve()),
    mounted = useRef(true),
    storageHealthy = useRef(true);
  const dark = useColorScheme() === "dark";
  const rtl = engine.languages.find((l) => l.code === language)?.rtl;
  const c = {
    bg: dark ? "#0D1723" : "#F5F7FA",
    surface: dark ? "#1C2B3C" : "#FFFFFF",
    text: dark ? "#EDF3FA" : "#102A43",
    muted: dark ? "#A6B7CA" : "#596D82",
    border: dark ? "#33465C" : "#DEE6EF",
    accent: dark ? "#8EBFFF" : "#175BB3",
  };
  const x = (key: string) =>
    (EXTRA[language] || EXTRA.en)[key] || EXTRA.en[key];
  const t = engine.text;
  const txt = {
    color: c.text,
    textAlign: rtl ? ("right" as const) : ("left" as const),
    writingDirection: rtl ? ("rtl" as const) : ("ltr" as const),
  };
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw) as Partial<Preferences>;
        if (engine.languages.some((l) => l.code === p.language))
          setLanguage(p.language!);
        const valid = (v: unknown): Trip[] =>
          Array.isArray(v)
            ? v
                .filter(
                  (a) =>
                    a &&
                    typeof a.from === "string" &&
                    typeof a.to === "string" &&
                    engine.parseToken(a.from) &&
                    engine.parseToken(a.to),
                )
                .slice(0, 50)
            : [];
        setFavourites(valid(p.favourites));
        setRecent(valid(p.recent));
      })
      .catch(() => {
        storageHealthy.current = false;
        Alert.alert(x("error"), x("storage"));
      })
      .finally(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (!hydrated || !storageHealthy.current) return;
    const value = JSON.stringify({ language, favourites, recent });
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(KEY, value))
      .catch(() => {
        if (mounted.current) Alert.alert(x("error"), x("storage"));
      });
  }, [hydrated, language, favourites, recent]);
  useEffect(() => {
    if (!hydrated) return;
    const open = (url: string) => {
      const trip = parseRouteLink(url, engine);
      if (trip) {
        setFrom(trip.from);
        setTo(trip.to);
        setTab("map");
        if (trip.language) setLanguage(trip.language);
      }
    };
    Linking.getInitialURL()
      .then((url) => {
        if (url) open(url);
      })
      .catch(() => {});
    const listener = Linking.addEventListener("url", (e) => open(e.url));
    return () => listener.remove();
  }, [hydrated]);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (languages) {
        setLanguages(false);
        return true;
      }
      if (tab === "saved") {
        setTab("map");
        return true;
      }
      if (from || to) {
        setFrom("");
        setTo("");
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [languages, tab, from, to]);
  const routes = useMemo(
    () => (from && to ? engine.plan(from, to, now) : []),
    [engine, from, to, now],
  );
  useEffect(() => {
    setOption(0);
    setExpanded(null);
  }, [from, to]);
  const route = routes[Math.min(option, routes.length - 1)];
  useEffect(() => {
    if (!hydrated || !from || !to || from === to || !route) return;
    const trip = { from, to };
    setRecent((prev) =>
      [trip, ...prev.filter((p) => !same(p, trip))].slice(0, 5),
    );
  }, [from, to, hydrated]);
  const hits = useMemo(
    () => engine.search(query).slice(0, 80),
    [engine, query],
  );
  const choose = (id: string) => {
    if (picker === "from" || (!picker && !from)) setFrom(id);
    else setTo(id);
    setPicker(null);
    setQuery("");
  };
  const pick = (which: "from" | "to") => {
    setQuery("");
    setPicker(which);
  };
  const locate = async () => {
    setLocating(true);
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== "granted") {
        Alert.alert(t("locBtn"), x("location"));
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const near = engine.nearestStation([
        location.coords.latitude,
        location.coords.longitude,
      ]);
      if (near && mounted.current) {
        setFrom(near.id);
        if (near.d > 1500)
          Alert.alert(
            t("locBtn"),
            t("locFar", {
              s: engine.stationName(near.id),
              k: (near.d / 1000).toFixed(1),
            }),
          );
      }
    } catch {
      Alert.alert(t("locBtn"), x("location"));
    } finally {
      if (mounted.current) setLocating(false);
    }
  };
  const share = async () => {
    try {
      await Share.share({
        message: `${engine.name(from)} → ${engine.name(to)}\n${t("minRange", { a: route.time, b: route.timeMax })} · ${t("changes", { n: route.xf })}\n${engine.shareUrl(from, to)}`,
      });
    } catch {
      Alert.alert(x("error"));
    }
  };
  const button = (
    label: string,
    fn: () => void,
    selected = false,
    accessibilityLabel = label,
  ) => (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={fn}
      style={[
        s.button,
        {
          backgroundColor: selected ? c.accent : c.surface,
          borderColor: c.border,
        },
      ]}
    >
      <Text
        style={[txt, { color: selected ? c.bg : c.text, fontWeight: "600" }]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const openTrip = (p: Trip) => {
    setFrom(p.from);
    setTo(p.to);
    setTab("map");
  };
  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <View style={[s.header, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[s.title, txt]}>
            {t("title")}
          </Text>
          <Text style={[txt, { color: c.muted, fontSize: 12 }]}>
            {x("offline")}
          </Text>
        </View>
        {button(language.toUpperCase(), () => setLanguages(true))}
      </View>
      <View style={[s.tabs, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        {button(x("map"), () => setTab("map"), tab === "map")}
        {button(x("saved"), () => setTab("saved"), tab === "saved")}
        {locating ? (
          <ActivityIndicator accessibilityLabel={x("loading")} />
        ) : (
          button("⌖", locate, false, t("locBtn"))
        )}
      </View>
      {tab === "map" ? (
        <>
          <View style={[s.fields, { backgroundColor: c.surface }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("phFrom")}
              onPress={() => pick("from")}
              style={s.field}
            >
              <Text numberOfLines={2} style={txt}>
                ● {from ? engine.name(from) : t("phFrom")}
              </Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("phTo")}
              onPress={() => pick("to")}
              style={s.field}
            >
              <Text numberOfLines={2} style={txt}>
                ◎ {to ? engine.name(to) : t("phTo")}
              </Text>
            </Pressable>
            <View style={s.row}>
              {button(t("swap"), () => {
                setFrom(to);
                setTo(from);
              })}
              {button(t("clear"), () => {
                setFrom("");
                setTo("");
              })}
            </View>
          </View>
          <MetroMap
            engine={engine}
            from={from}
            to={to}
            route={route}
            onStation={choose}
            dark={dark}
          />
          <ScrollView
            style={s.details}
            contentContainerStyle={{ padding: 16, gap: 12 }}
          >
            {!engine.serviceState(now).open && (
              <Text style={[txt, { color: dark ? "#FFD28C" : "#855000" }]}>
                {x("closed")}
              </Text>
            )}
            {!route ? (
              <Text style={txt}>{t(from ? "hintOne" : "hintNone")}</Text>
            ) : from === to ? (
              <Text style={txt}>{t("hintSame")}</Text>
            ) : (
              <>
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  {routes.map((r, i) => (
                    <Pressable
                      key={r.sig}
                      onPress={() => setOption(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: option === i }}
                      style={[
                        s.option,
                        {
                          borderColor: option === i ? c.accent : c.border,
                          backgroundColor: c.surface,
                        },
                      ]}
                    >
                      <Text style={[s.summary, txt]}>
                        {t("minRange", { a: r.time, b: r.timeMax })}
                      </Text>
                      <Text style={txt}>
                        {t("changes", { n: r.xf })} ·{" "}
                        {r.rides ? `${engine.fares.std} SAR` : "0 SAR"}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[txt, { color: c.muted }]}>{t("estNote")}</Text>
                {[from, to].map((id) => {
                  const p = engine.parseToken(id)?.lm;
                  return p && p.min > 0 ? (
                    <Text key={id} style={txt}>
                      {engine.name(id)}: {t("walkChip", { n: p.min })}
                      {p.note
                        ? ` · ${t("n_bus", { s: engine.stationName(engine.parseToken(id)!.st) })}`
                        : ""}
                    </Text>
                  ) : null;
                })}
                {route.legs.map((leg, i) =>
                  leg.type === "ride" ? (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      onPress={() => setExpanded(expanded === i ? null : i)}
                      style={[
                        s.leg,
                        {
                          borderLeftColor:
                            lineColors[
                              engine.services.find((l) => l.id === leg.svc)!
                                .line
                            ],
                          backgroundColor: c.surface,
                        },
                      ]}
                    >
                      <Text style={[txt, { fontWeight: "700" }]}>
                        {engine.lineName(leg.svc)} · {x("towards")}{" "}
                        {engine.direction(leg)}
                      </Text>
                      <Text style={txt}>
                        {engine.stationName(leg.stops[0])} →{" "}
                        {engine.stationName(leg.stops[leg.stops.length - 1])}
                      </Text>
                      <Text style={[txt, { color: c.muted }]}>
                        {t("stops", { n: leg.stops.length - 1 })} ⌄
                      </Text>
                      {expanded === i &&
                        leg.stops.map((id) => (
                          <Text key={id} style={[txt, { paddingVertical: 5 }]}>
                            • {engine.stationName(id)}
                          </Text>
                        ))}
                    </Pressable>
                  ) : (
                    <Text key={i} style={txt}>
                      {leg.type === "xfer" ? t("changes", { n: 1 }) : x("walk")}{" "}
                      · {engine.stationName(leg.from!)} ·{" "}
                      {t("min", { n: leg.t! })}
                    </Text>
                  ),
                )}
                <View style={s.row}>
                  {button(t("shareRoute"), share)}
                  {button(
                    favourites.some((p) => same(p, { from, to }))
                      ? x("unsave")
                      : x("save"),
                    () =>
                      setFavourites((prev) =>
                        prev.some((p) => same(p, { from, to }))
                          ? prev.filter((p) => !same(p, { from, to }))
                          : [{ from, to }, ...prev].slice(0, 50),
                      ),
                  )}
                </View>
              </>
            )}
            <Text style={[txt, { color: c.muted, fontSize: 12 }]}>
              {x("privacy")} · RCRC open data · © OpenStreetMap contributors
              (ODbL), Wikipedia
            </Text>
          </ScrollView>
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {[
            { title: x("saved"), data: favourites },
            { title: x("recent"), data: recent },
          ].map((group) => (
            <View key={group.title} style={{ gap: 8 }}>
              <Text style={[s.summary, txt]}>{group.title}</Text>
              {!group.data.length && <Text style={txt}>{x("empty")}</Text>}
              {group.data.map((p) => (
                <Pressable
                  key={p.from + "~" + p.to}
                  onPress={() => openTrip(p)}
                  style={[
                    s.leg,
                    { backgroundColor: c.surface, borderLeftColor: c.accent },
                  ]}
                >
                  <Text style={txt}>
                    {engine.name(p.from)} → {engine.name(p.to)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
      <Modal
        visible={!!picker}
        onRequestClose={() => setPicker(null)}
        animationType="slide"
      >
        <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
          <View style={s.header}>
            <Text style={[s.summary, txt]}>
              {picker === "from" ? t("phFrom") : t("phTo")}
            </Text>
            {button(t("close"), () => setPicker(null))}
          </View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            accessibilityLabel={x("choose")}
            placeholder={x("choose")}
            placeholderTextColor={c.muted}
            style={[
              s.input,
              txt,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          />
          <FlatList
            data={hits}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id || item.place!.id}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => choose(item.id || item.place!.id)}
                style={[s.searchRow, { borderBottomColor: c.border }]}
              >
                <Text style={[txt, { fontSize: 17 }]}>
                  {item.id ? engine.stationName(item.id) : item.place!.n}
                </Text>
                {item.id && engine.parkAndRide.has(item.id) && (
                  <Text style={[txt, { color: c.muted }]}>{t("parkRide")}</Text>
                )}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
      <Modal
        visible={languages}
        onRequestClose={() => setLanguages(false)}
        animationType="slide"
      >
        <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
          {button(t("close"), () => setLanguages(false))}
          <ScrollView>
            {engine.languages.map((l) => (
              <Pressable
                accessibilityRole="button"
                key={l.code}
                onPress={() => {
                  setLanguage(l.code);
                  setLanguages(false);
                }}
                style={s.searchRow}
              >
                <Text style={[txt, { fontSize: 22 }]}>
                  {l.native} {l.code === language ? "✓" : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { fontSize: 26, fontWeight: "800" },
  tabs: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  button: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fields: {
    marginHorizontal: 16,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  field: { minHeight: 48, justifyContent: "center", paddingVertical: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  details: { flex: 1, maxHeight: "40%" },
  summary: { fontSize: 20, fontWeight: "700" },
  option: { padding: 14, borderRadius: 16, borderWidth: 2, gap: 4 },
  leg: { borderLeftWidth: 4, borderRadius: 12, padding: 14, gap: 8 },
  input: {
    margin: 16,
    padding: 14,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 18,
  },
  searchRow: {
    minHeight: 58,
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
