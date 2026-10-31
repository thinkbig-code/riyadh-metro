import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MetroEngine } from "../core/metro";
import { getAppStrings } from "../i18n";
import { LINE_BY_ID, LineColorKey, STATION_BY_ID } from "../map/geometry";
import {
  AppTheme,
  directionalRow,
  directionalText,
  lineBadgeTextColor,
} from "../theme";

export interface StationCardProps {
  stationId: string | null;
  engine: MetroEngine;
  language: string;
  rtl: boolean;
  theme: AppTheme;
  onFromHere: (stationId: string) => void;
  onToHere: (stationId: string) => void;
  onClose: () => void;
}

export default function StationCard({
  stationId,
  engine,
  language,
  rtl,
  theme,
  onFromHere,
  onToHere,
  onClose,
}: StationCardProps) {
  const station = stationId ? STATION_BY_ID[stationId] : null;
  const nearby = useMemo(() => {
    if (!stationId) return [];
    return engine.places.filter((p) => p.st === stationId).slice(0, 4);
  }, [engine.places, stationId]);

  if (!station) return null;

  const { colors } = theme;
  const s = getAppStrings(language);
  const t = engine.text;
  const txt = directionalText(rtl, theme, false);
  const txtBold = directionalText(rtl, theme, true);
  const rowDir = directionalRow(rtl);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.rule },
      ]}
    >
      <View style={[styles.headerRow, rowDir]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.titlePrimary, txtBold]}>{station.ar}</Text>
          <Text style={[styles.titleSecondary, txt, { color: colors.muted }]}>
            {station.en} · #{station.number}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={onClose}
          style={[styles.closeBtn, { backgroundColor: colors.bg }]}
        >
          <Text style={{ color: colors.fg, fontWeight: "700" }}>✕</Text>
        </Pressable>
      </View>

      <View style={[styles.badgesRow, rowDir]}>
        {station.lines.map((lineKey: LineColorKey) => {
          const lineObj = LINE_BY_ID[lineKey];
          return (
            <View
              key={lineKey}
              style={[
                styles.linePill,
                rowDir,
                { backgroundColor: colors[lineKey] },
              ]}
            >
              <Text
                style={[
                  styles.linePillText,
                  { color: lineBadgeTextColor(lineKey) },
                ]}
              >
                {lineObj.number} · {engine.lineName(lineObj.service)}
              </Text>
            </View>
          );
        })}
        {engine.parkAndRide.has(station.id) && (
          <View
            style={[
              styles.parkPill,
              { backgroundColor: colors.bg, borderColor: colors.rule },
            ]}
          >
            <Text style={[styles.parkText, { color: colors.fg }]}>
              P · {t("parkRide")}
            </Text>
          </View>
        )}
      </View>

      {station.former.length > 0 && (
        <Text style={[styles.metaLine, txt, { color: colors.muted }]}>
          {s.formerNames}: {station.former.join(", ")}
        </Text>
      )}

      {nearby.length > 0 && (
        <View style={styles.nearbyWrap}>
          <Text style={[styles.nearbyTitle, txtBold]}>{s.nearbyPlaces}:</Text>
          {nearby.map((pl) => (
            <Text
              key={pl.id}
              numberOfLines={1}
              style={[styles.nearbyItem, txt, { color: colors.muted }]}
            >
              • {pl.n} ({t("walkChip", { n: pl.min })})
            </Text>
          ))}
        </View>
      )}

      <View style={[styles.actionsRow, rowDir]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onFromHere(station.id)}
          style={[
            styles.actionButton,
            { backgroundColor: colors.accent, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.actionText, { color: "#FFFFFF" }]}>
            {s.fromHere}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => onToHere(station.id)}
          style={[
            styles.actionButton,
            { backgroundColor: colors.bg, borderColor: colors.rule },
          ]}
        >
          <Text style={[styles.actionText, { color: colors.fg }]}>
            {s.toHere}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: "21%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  headerRow: {
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  titlePrimary: {
    fontSize: 18,
    fontWeight: "700",
  },
  titleSecondary: {
    fontSize: 14,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgesRow: {
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  linePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  linePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  parkPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  parkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  metaLine: {
    fontSize: 12,
  },
  nearbyWrap: {
    gap: 2,
  },
  nearbyTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  nearbyItem: {
    fontSize: 12,
  },
  actionsRow: {
    gap: 8,
    marginTop: 2,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
