import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { MetroEngine, SearchHit } from "../core/metro";
import { getAppStrings } from "../i18n";
import { LINE_BY_ID, LineColorKey, STATION_BY_ID } from "../map/geometry";
import {
  AppTheme,
  directionalRow,
  directionalText,
  lineBadgeTextColor,
} from "../theme";
import type { SavedTrip } from "./MenuSheet";

export interface SearchViewProps {
  engine: MetroEngine;
  language: string;
  rtl: boolean;
  theme: AppTheme;
  activeField: "from" | "to";
  query: string;
  onChangeQuery: (q: string) => void;
  onSelectToken: (token: string) => void;
  onSelectTrip: (trip: SavedTrip) => void;
  onUseLocation: () => void;
  onCloseSearch: () => void;
  recent: SavedTrip[];
}

const POPULAR_STATION_IDS = ["kafd", "stc", "museum", "hokm", "t12", "railway"];

export default function SearchView({
  engine,
  language,
  rtl,
  theme,
  activeField,
  query,
  onChangeQuery,
  onSelectToken,
  onSelectTrip,
  onUseLocation,
  onCloseSearch,
  recent,
}: SearchViewProps) {
  const { colors } = theme;
  const s = getAppStrings(language);
  const t = engine.text;
  const txt = directionalText(rtl, theme, false);
  const txtBold = directionalText(rtl, theme, true);
  const rowDir = directionalRow(rtl);

  const hits: SearchHit[] = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return engine.search(trimmed).slice(0, 60);
  }, [engine, query]);

  const popularPlaces = useMemo(() => engine.places.slice(0, 10), [engine]);

  const renderLineBadges = (stationId: string) => {
    const st = STATION_BY_ID[stationId];
    if (!st) return null;
    return (
      <View style={[styles.badgesWrap, rowDir]}>
        {st.lines.map((lineId: LineColorKey) => {
          const lineObj = LINE_BY_ID[lineId];
          const num = lineObj ? lineObj.number : "";
          return (
            <View
              key={`${stationId}-${lineId}`}
              style={[styles.lineBadge, { backgroundColor: colors[lineId] }]}
            >
              <Text
                style={[
                  styles.lineBadgeText,
                  { color: lineBadgeTextColor(lineId) },
                ]}
              >
                {num}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.searchInputRow, rowDir]}>
        <TextInput
          autoFocus
          value={query}
          onChangeText={onChangeQuery}
          placeholder={
            activeField === "from"
              ? `${t("phFrom")}: ${s.searchPlaceholder}`
              : `${t("phTo")}: ${s.searchPlaceholder}`
          }
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            txt,
            { backgroundColor: colors.bg, borderColor: colors.accent },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={onCloseSearch}
          style={[
            styles.cancelBtn,
            { backgroundColor: colors.bg, borderColor: colors.rule },
          ]}
        >
          <Text style={[styles.cancelText, txtBold]}>{t("close")}</Text>
        </Pressable>
      </View>

      {query.trim().length > 0 ? (
        <View style={styles.resultsList}>
          {hits.length === 0 ? (
            <Text style={[styles.emptyMsg, txt, { color: colors.muted }]}>
              {s.noSearchResults}
            </Text>
          ) : (
            hits.map((item) => {
              const isStation = Boolean(item.id);
              const token = item.id ?? item.place!.id;
              const stationId = item.id ?? item.place!.st;
              const st = STATION_BY_ID[stationId];
              const title = isStation
                ? engine.stationName(item.id!)
                : item.place!.n;

              return (
                <Pressable
                  key={token}
                  accessibilityRole="button"
                  onPress={() => onSelectToken(token)}
                  style={[
                    styles.resultRow,
                    rowDir,
                    { borderBottomColor: colors.rule },
                  ]}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isStation
                          ? colors.accent
                          : colors.bg,
                        borderColor: colors.rule,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isStation ? "#FFFFFF" : colors.fg,
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {isStation ? "M" : "⌖"}
                    </Text>
                  </View>

                  <View style={styles.resultMain}>
                    <View style={[styles.titleLine, rowDir]}>
                      <Text
                        numberOfLines={1}
                        style={[styles.resultTitle, txtBold]}
                      >
                        {title}
                      </Text>
                      {st && (
                        <Text
                          style={[
                            styles.stationNum,
                            { color: colors.muted },
                          ]}
                        >
                          #{st.number}
                        </Text>
                      )}
                    </View>

                    {!isStation && item.place && (
                      <Text
                        style={[styles.placeSub, txt, { color: colors.muted }]}
                      >
                        {engine.stationName(item.place.st)} ·{" "}
                        {t("walkChip", { n: item.place.min })}
                      </Text>
                    )}

                    {isStation && engine.parkAndRide.has(stationId) && (
                      <Text
                        style={[styles.placeSub, txt, { color: colors.muted }]}
                      >
                        P · {t("parkRide")}
                      </Text>
                    )}
                  </View>

                  {renderLineBadges(stationId)}
                </Pressable>
              );
            })
          )}
        </View>
      ) : (
        <View style={styles.emptyStateWrap}>
          <Pressable
            accessibilityRole="button"
            onPress={onUseLocation}
            style={[
              styles.locationRow,
              rowDir,
              { backgroundColor: colors.bg, borderColor: colors.rule },
            ]}
          >
            <Text style={[styles.locIcon, { color: colors.accent }]}>⌖</Text>
            <Text style={[styles.locLabel, txtBold, { color: colors.accent }]}>
              {s.useMyLocation}
            </Text>
          </Pressable>

          {recent.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeader, txtBold]}>
                {s.recentTrips}
              </Text>
              {recent.slice(0, 4).map((trip) => (
                <Pressable
                  key={`rec-${trip.from}~${trip.to}`}
                  onPress={() => onSelectTrip(trip)}
                  style={[
                    styles.quickRow,
                    rowDir,
                    { borderBottomColor: colors.rule },
                  ]}
                >
                  <Text style={[styles.quickRowText, txt]}>
                    {engine.name(trip.from)} → {engine.name(trip.to)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionHeader, txtBold]}>
              {s.popularPlaces}
            </Text>
            <View style={[styles.chipsGrid, rowDir]}>
              {POPULAR_STATION_IDS.map((sid) => (
                <Pressable
                  key={sid}
                  onPress={() => onSelectToken(sid)}
                  style={[
                    styles.popularChip,
                    rowDir,
                    { backgroundColor: colors.bg, borderColor: colors.rule },
                  ]}
                >
                  <Text style={[styles.chipText, txtBold]}>
                    {engine.stationName(sid)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {popularPlaces.map((pl) => (
              <Pressable
                key={pl.id}
                onPress={() => onSelectToken(pl.id)}
                style={[
                  styles.resultRow,
                  rowDir,
                  { borderBottomColor: colors.rule },
                ]}
              >
                <View style={styles.resultMain}>
                  <Text style={[styles.resultTitle, txtBold]}>{pl.n}</Text>
                  <Text style={[styles.placeSub, txt, { color: colors.muted }]}>
                    {engine.stationName(pl.st)} · {t("walkChip", { n: pl.min })}
                  </Text>
                </View>
                {renderLineBadges(pl.st)}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  searchInputRow: {
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  cancelBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
  },
  resultsList: {
    gap: 2,
  },
  emptyMsg: {
    paddingVertical: 20,
    fontSize: 14,
  },
  resultRow: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resultMain: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
    alignItems: "center",
    gap: 6,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  stationNum: {
    fontSize: 12,
    fontWeight: "600",
  },
  placeSub: {
    fontSize: 12,
  },
  badgesWrap: {
    gap: 4,
    alignItems: "center",
  },
  lineBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  lineBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyStateWrap: {
    gap: 16,
  },
  locationRow: {
    alignItems: "center",
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  locIcon: {
    fontSize: 18,
    fontWeight: "700",
  },
  locLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  sectionBlock: {
    gap: 6,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  quickRow: {
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quickRowText: {
    fontSize: 14,
  },
  chipsGrid: {
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  popularChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
});
