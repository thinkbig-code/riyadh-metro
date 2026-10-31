import React, { useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MetroEngine } from "../core/metro";
import { getAppStrings } from "../i18n";
import { MAP_GEOMETRY } from "../map/geometry";
import { AppTheme, directionalRow, directionalText } from "../theme";

export interface SavedTrip {
  from: string;
  to: string;
}

export type MenuSection = "language" | "saved" | "about";

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

export default function MenuSheet({
  visible,
  initialSection = "language",
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
  const [section, setSection] = useState<MenuSection>(initialSection);
  const s = getAppStrings(language);
  const t = engine.text;
  const { colors } = theme;
  const txt = directionalText(rtl, theme, false);
  const txtBold = directionalText(rtl, theme, true);
  const rowDir = directionalRow(rtl);

  const openFeedbackEmail = () => {
    Linking.openURL(
      `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Riyadh Metro App Feedback")}`,
    ).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />
        <SafeAreaView
          edges={["bottom", "left", "right"]}
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.rule },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.rule }]} />
          </View>

          <View style={[styles.header, rowDir]}>
            <Text style={[styles.headerTitle, txtBold]}>{s.menu}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("close")}
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.bg }]}
            >
              <Text style={[styles.closeText, { color: colors.fg }]}>✕</Text>
            </Pressable>
          </View>

          <View style={[styles.tabsRow, rowDir]}>
            {(
              [
                { id: "language" as const, label: s.languageTitle },
                { id: "saved" as const, label: s.savedTrips },
                { id: "about" as const, label: s.aboutTitle },
              ] as const
            ).map((tab) => {
              const active = section === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSection(tab.id)}
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: active ? colors.accent : colors.bg,
                      borderColor: active ? colors.accent : colors.rule,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      txtBold,
                      { color: active ? "#FFFFFF" : colors.fg, textAlign: "center" },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            {section === "language" && (
              <View style={styles.listGroup}>
                {engine.languages.map((lang) => {
                  const selected = lang.code === language;
                  return (
                    <Pressable
                      key={lang.code}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        onSelectLanguage(lang.code);
                        onClose();
                      }}
                      style={[
                        styles.langRow,
                        rowDir,
                        {
                          backgroundColor: selected ? colors.bg : "transparent",
                          borderColor: colors.rule,
                        },
                      ]}
                    >
                      <Text style={[styles.langNative, txtBold]}>
                        {lang.native}
                      </Text>
                      <Text
                        style={[
                          styles.langCode,
                          { color: selected ? colors.accent : colors.muted },
                        ]}
                      >
                        {selected ? "✓" : lang.code.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {section === "saved" && (
              <View style={styles.savedContainer}>
                <Text style={[styles.sectionSubheading, txtBold]}>
                  {s.savedTrips}
                </Text>
                {favourites.length === 0 ? (
                  <Text style={[styles.emptyText, txt, { color: colors.muted }]}>
                    {s.noSavedTrips}
                  </Text>
                ) : (
                  favourites.map((trip) => (
                    <View
                      key={`fav-${trip.from}~${trip.to}`}
                      style={[
                        styles.tripCard,
                        rowDir,
                        { backgroundColor: colors.bg, borderColor: colors.rule },
                      ]}
                    >
                      <Pressable
                        style={styles.tripMainArea}
                        onPress={() => {
                          onSelectTrip(trip);
                          onClose();
                        }}
                      >
                        <Text style={[styles.tripText, txtBold]}>
                          {engine.name(trip.from)} → {engine.name(trip.to)}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => onRemoveFavourite(trip)}
                        style={styles.removeBtn}
                      >
                        <Text style={{ color: colors.danger, fontSize: 16 }}>
                          ★
                        </Text>
                      </Pressable>
                    </View>
                  ))
                )}

                <Text
                  style={[
                    styles.sectionSubheading,
                    txtBold,
                    { marginTop: 16 },
                  ]}
                >
                  {s.recentTrips}
                </Text>
                {recent.length === 0 ? (
                  <Text style={[styles.emptyText, txt, { color: colors.muted }]}>
                    {s.noRecentTrips}
                  </Text>
                ) : (
                  recent.map((trip) => (
                    <Pressable
                      key={`rec-${trip.from}~${trip.to}`}
                      onPress={() => {
                        onSelectTrip(trip);
                        onClose();
                      }}
                      style={[
                        styles.tripCard,
                        rowDir,
                        { backgroundColor: colors.bg, borderColor: colors.rule },
                      ]}
                    >
                      <Text style={[styles.tripText, txt]}>
                        {engine.name(trip.from)} → {engine.name(trip.to)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {section === "about" && (
              <View style={styles.aboutContainer}>
                <View
                  style={[
                    styles.aboutCard,
                    { backgroundColor: colors.bg, borderColor: colors.rule },
                  ]}
                >
                  <Text style={[styles.aboutTitle, txtBold]}>{t("title")}</Text>
                  <Text style={[styles.aboutBody, txt]}>
                    {s.unofficialDisclaimer}
                  </Text>
                </View>

                <View
                  style={[
                    styles.aboutCard,
                    { backgroundColor: colors.bg, borderColor: colors.rule },
                  ]}
                >
                  <Text style={[styles.aboutHeading, txtBold]}>
                    {s.dataCreditsTitle}
                  </Text>
                  <Text style={[styles.aboutBody, txt]}>
                    {s.dataCreditsBody}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="link"
                  onPress={openFeedbackEmail}
                  style={[
                    styles.aboutCard,
                    { backgroundColor: colors.bg, borderColor: colors.rule },
                  ]}
                >
                  <Text style={[styles.aboutHeading, txtBold]}>
                    {s.feedbackLabel}
                  </Text>
                  <Text
                    style={[
                      styles.emailLink,
                      txt,
                      { color: colors.accent },
                    ]}
                  >
                    {FEEDBACK_EMAIL}
                  </Text>
                </Pressable>

                <View style={[styles.metaRow, rowDir]}>
                  <Text style={[styles.metaText, txt, { color: colors.muted }]}>
                    {s.versionLabel}: {APP_VERSION}
                  </Text>
                  <Text style={[styles.metaText, txt, { color: colors.muted }]}>
                    {s.dataDateLabel}: {DATA_DATE} ({MAP_GEOMETRY.sourceSha256.slice(0, 7)})
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
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
    maxHeight: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  tabsRow: {
    gap: 8,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: 20,
  },
  listGroup: {
    gap: 8,
  },
  langRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  langNative: {
    fontSize: 17,
    fontWeight: "600",
  },
  langCode: {
    fontSize: 15,
    fontWeight: "700",
  },
  savedContainer: {
    gap: 8,
  },
  sectionSubheading: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 8,
  },
  tripCard: {
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  tripMainArea: {
    flex: 1,
  },
  tripText: {
    fontSize: 15,
    fontWeight: "600",
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  aboutContainer: {
    gap: 12,
  },
  aboutCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  aboutTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  aboutHeading: {
    fontSize: 15,
    fontWeight: "700",
  },
  aboutBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  emailLink: {
    fontSize: 15,
    fontWeight: "600",
  },
  metaRow: {
    justifyContent: "space-between",
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  metaText: {
    fontSize: 12,
  },
});
