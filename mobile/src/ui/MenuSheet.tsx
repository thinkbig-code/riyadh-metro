import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  LayoutAnimation,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MetroEngine } from "../core/metro";
import { getAppStrings } from "../i18n";
import { MAP_GEOMETRY } from "../map/geometry";
import { AppTheme, directionalRow, directionalText } from "../theme";
import { ChevronIcon } from "./Icons";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export interface SavedTrip {
  from: string;
  to: string;
}

export type MenuSection = "language" | "saved" | "about";
type OpenSection = "saved" | "recent" | "settings" | "about" | "feedback" | null;

export interface MenuSheetProps {
  visible: boolean;
  initialSection?: MenuSection;
  onClose: () => void;
  engine: MetroEngine;
  language: string;
  onSelectLanguage: (code: string) => void;
  favourites: SavedTrip[];
  recent: SavedTrip[];
  onSelectTrip: (trip: SavedTrip) => void;
  onRemoveFavourite: (trip: SavedTrip) => void;
  onClearRecent: () => void;
  themePref: "auto" | "light" | "dark";
  onChangeThemePref: (v: "auto" | "light" | "dark") => void;
  mapLabels: "auto" | "en" | "ar";
  onChangeMapLabels: (v: "auto" | "en" | "ar") => void;
  quickTap: boolean;
  onChangeQuickTap: (v: boolean) => void;
  theme: AppTheme;
  rtl: boolean;
}

const APP_VERSION = "0.1.0";
const DATA_DATE = "2026-10-31";
const FEEDBACK_EMAIL = "callmebackemail@protonmail.com";
const SCREEN_H = Dimensions.get("window").height;

// The menu: a short list of rows (saved trips, recent trips, language, about, feedback). Each row
// opens in place when tapped, one at a time. The sheet slides up over a fading backdrop and can
// be dragged down by its top bar to close.
export default function MenuSheet({
  visible,
  onClose,
  engine,
  language,
  onSelectLanguage,
  favourites,
  recent,
  onSelectTrip,
  onRemoveFavourite,
  onClearRecent,
  themePref,
  onChangeThemePref,
  mapLabels,
  onChangeMapLabels,
  quickTap,
  onChangeQuickTap,
  theme,
  rtl,
}: MenuSheetProps) {
  const s = getAppStrings(language);
  const t = engine.text;
  const { colors } = theme;
  const txt = directionalText(rtl, theme, false);
  const txtBold = directionalText(rtl, theme, true);
  const rowDir = directionalRow(rtl);
  const [open, setOpen] = useState<OpenSection>(null);
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(SCREEN_H)).current;
  const closing = useRef(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setOpen(null);
      closing.current = false;
      slide.setValue(SCREEN_H);
      Animated.timing(slide, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(slide, {
        toValue: SCREEN_H,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animateClose = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(slide, {
      toValue: SCREEN_H,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setMounted(false);
      onClose();
    });
  };

  const drag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_e, g) => slide.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 90 || g.vy > 0.9) {
          animateClose();
        } else {
          Animated.spring(slide, { toValue: 0, friction: 8, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const toggle = (section: OpenSection) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
    setOpen((cur) => (cur === section ? null : section));
  };

  const openFeedbackEmail = () => {
    Linking.openURL(
      `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Riyadh Metro App Feedback")}`,
    ).catch(() => {});
  };

  const currentLanguage =
    engine.languages.find((l) => l.code === language)?.native ?? language;

  const row = (
    section: Exclude<OpenSection, null>,
    title: string,
    value: string | null,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open === section }}
      onPress={() => toggle(section)}
      style={[styles.row, rowDir]}
    >
      <Text style={[styles.rowTitle, txtBold]}>{title}</Text>
      <View style={[styles.rowEnd, rowDir]}>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.muted }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <ChevronIcon color={colors.muted} open={open === section} rtl={rtl} />
      </View>
    </Pressable>
  );

  const tripRow = (trip: SavedTrip, saved: boolean) => (
    <View key={`${saved ? "fav" : "rec"}-${trip.from}~${trip.to}`} style={[styles.tripRow, rowDir]}>
      <Pressable
        style={styles.tripMainArea}
        onPress={() => {
          onSelectTrip(trip);
          animateClose();
        }}
      >
        <Text style={[styles.tripText, txt]} numberOfLines={2}>
          {engine.name(trip.from)} → {engine.name(trip.to)}
        </Text>
      </Pressable>
      {saved ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onRemoveFavourite(trip)}
          hitSlop={10}
          style={styles.removeBtn}
        >
          <Text style={{ color: colors.accent, fontSize: 18 }}>★</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const divider = <View style={[styles.divider, { backgroundColor: colors.rule }]} />;

  // minimal choice: plain words, the chosen one in the accent colour with a thin underline
  function choices<T extends string>(
    options: { value: T; label: string }[],
    value: T,
    onChange: (v: T) => void,
  ) {
    return (
      <View style={[styles.choiceRow, rowDir]}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              hitSlop={6}
              style={[styles.choice, { borderBottomColor: on ? colors.accent : "transparent" }]}
            >
              <Text style={[styles.choiceText, { color: on ? colors.accent : colors.muted }, on && styles.choiceOn]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  const settingLabel = (label: string) => (
    <Text style={[styles.settingLabel, txt, { color: colors.muted }]}>{label}</Text>
  );

  return (
    <Modal visible={mounted} animationType="fade" transparent onRequestClose={animateClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={animateClose} />
        <Animated.View style={{ transform: [{ translateY: slide }] }}>
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.rule }]}
          >
            <View {...drag.panHandlers}>
              <View style={styles.handleWrap}>
                <View style={[styles.handle, { backgroundColor: colors.muted }]} />
              </View>
              <View style={[styles.header, rowDir]}>
                <Text style={[styles.headerTitle, txtBold]}>{s.menu}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("close")}
                  onPress={animateClose}
                  style={[styles.closeButton, { backgroundColor: colors.bg }]}
                >
                  <Text style={[styles.closeText, { color: colors.fg }]}>✕</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {row("saved", s.savedTrips, favourites.length ? String(favourites.length) : null)}
              {open === "saved" ? (
                <View style={styles.panel}>
                  {favourites.length === 0 ? (
                    <Text style={[styles.emptyText, txt, { color: colors.muted }]}>{s.noSavedTrips}</Text>
                  ) : (
                    favourites.map((trip) => tripRow(trip, true))
                  )}
                </View>
              ) : null}
              {divider}
              {row("recent", s.recentTrips, null)}
              {open === "recent" ? (
                <View style={styles.panel}>
                  {recent.length === 0 ? (
                    <Text style={[styles.emptyText, txt, { color: colors.muted }]}>{s.noRecentTrips}</Text>
                  ) : (
                    <>
                      {recent.slice(0, 5).map((trip) => tripRow(trip, false))}
                      <Pressable accessibilityRole="button" onPress={onClearRecent} hitSlop={6} style={styles.textButton}>
                        <Text style={[styles.textButtonLabel, txt, { color: colors.muted }]}>{s.clearHistory}</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : null}
              {divider}
              {row("settings", s.settings, null)}
              {open === "settings" ? (
                <View style={[styles.panel, { gap: 14 }]}>
                  <View>
                    {settingLabel(s.languageTitle)}
                    {choices(
                      engine.languages.map((l) => ({ value: l.code, label: l.native })),
                      language,
                      onSelectLanguage,
                    )}
                  </View>
                  <View>
                    {settingLabel(s.mapLabels)}
                    {choices(
                      [
                        { value: "auto" as const, label: s.sameAsApp },
                        { value: "en" as const, label: "English" },
                        { value: "ar" as const, label: "العربية" },
                      ],
                      mapLabels,
                      onChangeMapLabels,
                    )}
                  </View>
                  <View>
                    {settingLabel(s.theme)}
                    {choices(
                      [
                        { value: "auto" as const, label: s.themeAuto },
                        { value: "light" as const, label: s.themeLight },
                        { value: "dark" as const, label: s.themeDark },
                      ],
                      themePref,
                      onChangeThemePref,
                    )}
                  </View>
                  <View style={[styles.switchRow, rowDir]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.switchTitle, txt]}>{s.quickTap}</Text>
                      <Text style={[styles.switchHint, txt, { color: colors.muted }]}>{s.quickTapHint}</Text>
                    </View>
                    <Switch
                      value={quickTap}
                      onValueChange={onChangeQuickTap}
                      trackColor={{ false: colors.rule, true: colors.accent }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              ) : null}
              {divider}
              {row("about", s.aboutTitle, null)}
              {open === "about" ? (
                <View style={styles.panel}>
                  <Text style={[styles.aboutBody, txt]}>{s.unofficialDisclaimer}</Text>
                  <Text style={[styles.aboutBody, txt, { color: colors.muted }]}>{s.dataCreditsBody}</Text>
                </View>
              ) : null}
              {divider}
              {/* the address stays folded away until the row is opened */}
              {row("feedback", s.feedbackLabel, null)}
              {open === "feedback" ? (
                <View style={styles.panel}>
                  <Pressable accessibilityRole="link" onPress={openFeedbackEmail} hitSlop={6}>
                    <Text style={[styles.aboutBody, txt, { color: colors.accent }]}>{FEEDBACK_EMAIL}</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={[styles.metaText, { color: colors.muted }]}>
                {s.versionLabel} {APP_VERSION} · {s.dataDateLabel} {DATA_DATE} ({MAP_GEOMETRY.sourceSha256.slice(0, 7)})
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    maxHeight: SCREEN_H * 0.88,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    opacity: 0.6,
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: 12,
  },
  group: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    gap: 12,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: "500",
  },
  rowEnd: {
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  rowValue: {
    fontSize: 15,
    flexShrink: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  panel: {
    paddingHorizontal: 4,
    paddingBottom: 16,
    gap: 8,
  },
  choiceRow: {
    flexWrap: "wrap",
    columnGap: 18,
    rowGap: 6,
    marginTop: 6,
  },
  choice: {
    paddingVertical: 4,
    borderBottomWidth: 2,
  },
  choiceText: {
    fontSize: 15,
  },
  choiceOn: {
    fontWeight: "700",
  },
  settingLabel: {
    fontSize: 13,
  },
  switchRow: {
    alignItems: "center",
    gap: 12,
  },
  switchTitle: {
    fontSize: 15,
  },
  switchHint: {
    fontSize: 13,
    marginTop: 2,
  },
  textButton: {
    paddingVertical: 6,
  },
  textButtonLabel: {
    fontSize: 14,
    textDecorationLine: "underline",
  },
  langGrid: {
    flexWrap: "wrap",
  },
  langChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  langChipText: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 4,
  },
  tripRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  tripMainArea: {
    flex: 1,
  },
  tripText: {
    fontSize: 15,
    fontWeight: "500",
  },
  removeBtn: {
    paddingHorizontal: 8,
  },
  aboutHeading: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  aboutBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaText: {
    fontSize: 12,
    textAlign: "center",
    paddingTop: 4,
  },
});
