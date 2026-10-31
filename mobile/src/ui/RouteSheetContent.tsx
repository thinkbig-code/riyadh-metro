import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Leg, MetroEngine, Route } from "../core/metro";
import { getAppStrings } from "../i18n";
import { LINE_BY_SERVICE, LineColorKey } from "../map/geometry";
import {
  AppTheme,
  directionalRow,
  directionalText,
  lineBadgeTextColor,
} from "../theme";

export interface RouteSheetContentProps {
  engine: MetroEngine;
  language: string;
  rtl: boolean;
  theme: AppTheme;
  from: string;
  to: string;
  routes: Route[];
  selectedOption: number;
  onSelectOption: (idx: number) => void;
  departMs: number;
  onChangeDepartOffsetMin: (offsetMinutes: number) => void;
  departOffsetMin: number;
  isSaved: boolean;
  onToggleSave: () => void;
  onShare: () => void;
}

const DEPART_OFFSETS = [0, 15, 30, 60, 120];

function formatClock(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function RouteSheetContent({
  engine,
  language,
  rtl,
  theme,
  from,
  to,
  routes,
  selectedOption,
  onSelectOption,
  departMs,
  onChangeDepartOffsetMin,
  departOffsetMin,
  isSaved,
  onToggleSave,
  onShare,
}: RouteSheetContentProps) {
  const [expandedLeg, setExpandedLeg] = useState<number | null>(null);
  const { colors } = theme;
  const s = getAppStrings(language);
  const t = engine.text;
  const txt = directionalText(rtl, theme, false);
  const txtBold = directionalText(rtl, theme, true);
  const rowDir = directionalRow(rtl);

  const route = routes[Math.min(selectedOption, routes.length - 1)];
  if (!route) return null;

  const serviceStatus = engine.serviceState(departMs);
  const arrMinClock = formatClock(departMs + route.time * 60000);
  const arrMaxClock = formatClock(departMs + route.timeMax * 60000);

  const resolveLineColor = (leg: Leg): LineColorKey => {
    const svc = engine.services.find((item) => item.id === leg.svc);
    const key = (svc?.line || LINE_BY_SERVICE[leg.svc]?.id || "blue") as LineColorKey;
    return key;
  };

  const resolveLineNum = (leg: Leg): number => {
    const m = LINE_BY_SERVICE[leg.svc];
    return m ? m.number : Number(leg.svc.replace(/\D/g, "")) || 1;
  };

  return (
    <View style={styles.container}>
      {!serviceStatus.open && (
        <View
          style={[
            styles.warningBanner,
            { backgroundColor: colors.warningBg, borderColor: colors.warningFg },
          ]}
        >
          <Text style={[styles.warningText, txtBold, { color: colors.warningFg }]}>
            {s.metroClosedWarning}
          </Text>
        </View>
      )}

      <View style={[styles.departRow, rowDir]}>
        <Text style={[styles.departLabel, txtBold]}>{s.leaveLater}:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.departPills, rowDir]}
        >
          {DEPART_OFFSETS.map((offset) => {
            const active = departOffsetMin === offset;
            const label =
              offset === 0 ? s.leaveNow : `+${offset}m (${formatClock(departMs)})`;
            return (
              <Pressable
                key={offset}
                onPress={() => onChangeDepartOffsetMin(offset)}
                style={[
                  styles.departPill,
                  {
                    backgroundColor: active ? colors.accent : colors.bg,
                    borderColor: active ? colors.accent : colors.rule,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.departPillText,
                    { color: active ? "#FFFFFF" : colors.fg },
                  ]}
                >
                  {offset === 0 ? s.leaveNow : `+${offset}m`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {routes.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.optionsRow, rowDir]}
        >
          {routes.map((r, idx) => {
            const selected = idx === selectedOption;
            const rideLegs = r.legs.filter((l) => l.type === "ride");
            return (
              <Pressable
                key={r.sig}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelectOption(idx)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.bg,
                    borderColor: selected ? colors.accent : colors.rule,
                  },
                ]}
              >
                <View style={[styles.optionBadges, rowDir]}>
                  {rideLegs.map((leg, lIdx) => {
                    const lColor = resolveLineColor(leg);
                    const lNum = resolveLineNum(leg);
                    return (
                      <View
                        key={`${r.sig}-${lIdx}`}
                        style={[
                          styles.smallLineBadge,
                          { backgroundColor: colors[lColor] },
                        ]}
                      >
                        <Text
                          style={[
                            styles.smallLineBadgeTxt,
                            { color: lineBadgeTextColor(lColor) },
                          ]}
                        >
                          {lNum}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.optionTime, txtBold]}>
                  {t("minRange", { a: r.time, b: r.timeMax })}
                </Text>
                <Text style={[styles.optionSub, txt, { color: colors.muted }]}>
                  {t("changes", { n: r.xf })} ·{" "}
                  {r.rides ? `${engine.fares.std} SAR` : "0 SAR"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View
        style={[
          styles.summaryBanner,
          rowDir,
          { backgroundColor: colors.bg, borderColor: colors.rule },
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.arrivalText, txtBold]}>
            {s.arrivalLabel}: {arrMinClock} - {arrMaxClock}
          </Text>
          <Text style={[styles.fareSub, txt, { color: colors.muted }]}>
            {route.rides
              ? `${engine.fares.std} SAR (${s.firstClassLabel}: ${engine.fares.first} SAR)`
              : "0 SAR"}{" "}
            · {t("stops", { n: route.stops })}
          </Text>
        </View>
      </View>

      {[from, to].map((tok) => {
        const parsed = engine.parseToken(tok);
        const lm = parsed?.lm;
        if (!lm || lm.min <= 0) return null;
        return (
          <View
            key={`lm-${tok}`}
            style={[
              styles.placeNoteBox,
              { backgroundColor: colors.bg, borderColor: colors.rule },
            ]}
          >
            <Text style={[styles.placeNoteText, txt]}>
              {engine.name(tok)}: {t("walkChip", { n: lm.min })}
              {lm.note
                ? ` · ${t("n_bus", { s: engine.stationName(parsed!.st) })}`
                : ""}
            </Text>
          </View>
        );
      })}

      <View style={styles.timeline}>
        {route.legs.map((leg, i) => {
          if (leg.type === "ride") {
            const lineKey = resolveLineColor(leg);
            const lineNum = resolveLineNum(leg);
            const lineHex = colors[lineKey];
            const isExpanded = expandedLeg === i;
            const firstStop = leg.stops[0];
            const lastStop = leg.stops[leg.stops.length - 1];
            const intermediate = leg.stops.slice(1, -1);

            return (
              <Pressable
                key={`leg-${i}`}
                onPress={() => setExpandedLeg(isExpanded ? null : i)}
                style={[
                  styles.rideCard,
                  {
                    backgroundColor: colors.bg,
                    borderColor: colors.rule,
                    borderLeftColor: rtl ? colors.rule : lineHex,
                    borderRightColor: rtl ? lineHex : colors.rule,
                    borderLeftWidth: rtl ? 1 : 5,
                    borderRightWidth: rtl ? 5 : 1,
                  },
                ]}
              >
                <View style={[styles.rideHeader, rowDir]}>
                  <View
                    style={[
                      styles.lineBadge,
                      { backgroundColor: lineHex },
                    ]}
                  >
                    <Text
                      style={[
                        styles.lineBadgeTxt,
                        { color: lineBadgeTextColor(lineKey) },
                      ]}
                    >
                      {lineNum}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rideTitle, txtBold]}>
                      {engine.lineName(leg.svc)} · {s.towards}{" "}
                      {engine.direction(leg)}
                    </Text>
                    <Text
                      style={[styles.rideStopsSummary, txt, { color: colors.muted }]}
                    >
                      {t("stops", { n: leg.stops.length - 1 })}
                      {leg.t ? ` · ${t("min", { n: leg.t })}` : ""}{" "}
                      {intermediate.length > 0 ? (isExpanded ? "▴" : "▾") : ""}
                    </Text>
                  </View>
                </View>

                <View style={styles.endpointsWrap}>
                  <Text style={[styles.endpointStation, txtBold]}>
                    ● {engine.stationName(firstStop)}
                  </Text>
                  {isExpanded &&
                    intermediate.map((sid) => (
                      <Text
                        key={sid}
                        style={[
                          styles.intermediateStop,
                          txt,
                          { color: colors.muted },
                        ]}
                      >
                        · {engine.stationName(sid)}
                      </Text>
                    ))}
                  <Text style={[styles.endpointStation, txtBold]}>
                    ◎ {engine.stationName(lastStop)}
                  </Text>
                </View>
              </Pressable>
            );
          }

          return (
            <View
              key={`leg-${i}`}
              style={[
                styles.xferRow,
                rowDir,
                { borderColor: colors.rule },
              ]}
            >
              <Text style={[styles.xferText, txt, { color: colors.muted }]}>
                {leg.type === "xfer" ? t("changes", { n: 1 }) : s.walking} ·{" "}
                {leg.from ? engine.stationName(leg.from) : ""} ·{" "}
                {t("min", { n: leg.t ?? 3 })}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.estNote, txt, { color: colors.muted }]}>
        {t("estNote")}
      </Text>

      <View style={[styles.actionsRow, rowDir]}>
        <Pressable
          accessibilityRole="button"
          onPress={onShare}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.accent, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>
            {t("shareRoute")}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onToggleSave}
          style={[
            styles.actionBtn,
            {
              backgroundColor: isSaved ? colors.bg : colors.surface,
              borderColor: isSaved ? colors.accent : colors.rule,
            },
          ]}
        >
          <Text
            style={[
              styles.actionBtnText,
              { color: isSaved ? colors.accent : colors.fg },
            ]}
          >
            {isSaved ? `★ ${s.savedLabel}` : `☆ ${s.saveTrip}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  warningBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 13,
  },
  departRow: {
    alignItems: "center",
    gap: 8,
  },
  departLabel: {
    fontSize: 13,
  },
  departPills: {
    gap: 6,
  },
  departPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  departPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  optionsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  optionCard: {
    minWidth: 135,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 4,
  },
  optionBadges: {
    gap: 4,
  },
  smallLineBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  smallLineBadgeTxt: {
    fontSize: 11,
    fontWeight: "700",
  },
  optionTime: {
    fontSize: 15,
    fontWeight: "700",
  },
  optionSub: {
    fontSize: 12,
  },
  summaryBanner: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  arrivalText: {
    fontSize: 14,
    fontWeight: "700",
  },
  fareSub: {
    fontSize: 12,
  },
  placeNoteBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  placeNoteText: {
    fontSize: 13,
  },
  timeline: {
    gap: 8,
  },
  rideCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  rideHeader: {
    alignItems: "center",
    gap: 10,
  },
  lineBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  lineBadgeTxt: {
    fontSize: 13,
    fontWeight: "700",
  },
  rideTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  rideStopsSummary: {
    fontSize: 12,
    marginTop: 2,
  },
  endpointsWrap: {
    gap: 4,
    paddingHorizontal: 4,
  },
  endpointStation: {
    fontSize: 14,
    fontWeight: "600",
  },
  intermediateStop: {
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 1,
  },
  xferRow: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderLeftWidth: 2,
    marginHorizontal: 8,
  },
  xferText: {
    fontSize: 13,
  },
  estNote: {
    fontSize: 12,
  },
  actionsRow: {
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
