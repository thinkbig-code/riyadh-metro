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
type OpenSection = "saved" | "recent" | "language" | "about" | "feedback" | null;

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
              <View style={[styles.group, { backgroundColor: colors.bg, borderColor: colors.rule }]}>
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
                      recent.slice(0, 5).map((trip) => tripRow(trip, false))
                    )}
                  </View>
                ) : null}
              </View>

              <View style={[styles.group, { backgroundColor: colors.bg, borderColor: colors.rule }]}>
                {row("language", s.languageTitle, currentLanguage)}
                {open === "language" ? (
                  <View style={[styles.panel, styles.langGrid, rowDir]}>
                    {engine.languages.map((lang) => {
                      const selected = lang.code === language;
                      return (
                        <Pressable
                          key={lang.code}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => onSelectLanguage(lang.code)}
                          style={[
                            styles.langChip,
                            {
                              backgroundColor: selected ? colors.accent : colors.surface,
                              borderColor: selected ? colors.accent : colors.rule,
                            },
                          ]}
                        >
                          <Text style={[styles.langChipText, { color: selected ? "#FFFFFF" : colors.fg }]}>
                            {lang.native}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <View style={[styles.group, { backgroundColor: colors.bg, borderColor: colors.rule }]}>
                {row("about", s.aboutTitle, null)}
                {open === "about" ? (
                  <View style={styles.panel}>
                    <Text style={[styles.aboutBody, txt]}>{s.unofficialDisclaimer}</Text>
                    <Text style={[styles.aboutHeading, txtBold]}>{s.dataCreditsTitle}</Text>
                    <Text style={[styles.aboutBody, txt, { color: colors.muted }]}>{s.dataCreditsBody}</Text>
                  </View>
                ) : null}
                {divider}
                {/* the address stays folded away until the row is opened */}
                {row("feedback", s.feedbackLabel, null)}
                {open === "feedback" ? (
                  <View style={styles.panel}>
                    <Pressable accessibilityRole="link" onPress={openFeedbackEmail} hitSlop={6}>
                      <Text style={[styles.aboutBody, txt, { color: colors.accent }]}>
                        {FEEDBACK_EMAIL}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

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
    gap: 12,
    paddingBottom: 12,
  },
  group: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    gap: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
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
    marginHorizontal: 16,
  },
  panel: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
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
