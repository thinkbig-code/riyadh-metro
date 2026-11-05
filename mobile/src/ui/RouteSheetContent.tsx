import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Leg, MetroEngine, Route } from "../core/metro";
import {
  formatMinutes,
  formatPlaceDetails,
  formatStops,
  formatTransfers,
  formatTransferStepLabel,
  getAppStrings,
} from "../i18n";
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
  customDepartMs: number | null;
  onChangeCustomDepartMs: (ms: number | null) => void;
  isSaved: boolean;
  onToggleSave: () => void;
  onShare: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

// All clock times are Riyadh time (UTC+3, no daylight saving), like the engine and the site,
// whatever time zone the phone is set to.
const RIYADH_OFFSET_MS = 3 * 3600000;
function riyadhParts(ms: number): { h: number; m: number } {
  const d = new Date(ms + RIYADH_OFFSET_MS);
  return { h: d.getUTCHours(), m: d.getUTCMinutes() };
}
function formatClock(ms: number): string {
  const { h, m } = riyadhParts(ms);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
// the next moment (today, or tomorrow if already more than an hour ago) at h:m Riyadh time
function riyadhTimeToMs(hour: number, minute: number, nowMs: number): number {
  const day = new Date(nowMs + RIYADH_OFFSET_MS);
  day.setUTCHours(hour, minute, 0, 0);
  let ms = day.getTime() - RIYADH_OFFSET_MS;
  if (ms < nowMs - 3600000) ms += 86400000;
  return ms;
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
  customDepartMs,
  onChangeCustomDepartMs,
  isSaved,
  onToggleSave,
  onShare,
}: RouteSheetContentProps) {
  const [expandedLeg, setExpandedLeg] = useState<number | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const initClock = riyadhParts(departMs);
  const [pickedHour, setPickedHour] = useState<number>(initClock.h);
  const [pickedMinute, setPickedMinute] = useState<number>(
    Math.floor(initClock.m / 5) * 5,
  );

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

  const openTimePicker = () => {
    const c = riyadhParts(departMs);
    setPickedHour(c.h);
    setPickedMinute(Math.floor(c.m / 5) * 5);
    setPickerVisible(true);
  };

  const applyPickedTime = (hour: number, minute: number) => {
    onChangeCustomDepartMs(riyadhTimeToMs(hour, minute, Date.now()));
    setPickerVisible(false);
  };

  const resolveLineColor = (leg: Leg): LineColorKey => {
    const svc = engine.services.find((item) => item.id === leg.svc);
    const key = (svc?.line || LINE_BY_SERVICE[leg.svc]?.id || "blue") as LineColorKey;
    return key;
  };

  const resolveLineNum = (leg: Leg): number => {
    const m = LINE_BY_SERVICE[leg.svc];
    return m ? m.number : Number(leg.svc.replace(/\D/g, "")) || 1;
  };

  const isLeaveNow = customDepartMs === null;

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

      <View style={[styles.departButtonsRow, rowDir]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isLeaveNow }}
          onPress={() => onChangeCustomDepartMs(null)}
          style={[
            styles.departChoiceBtn,
            {
              backgroundColor: isLeaveNow ? colors.accent : colors.bg,
              borderColor: isLeaveNow ? colors.accent : colors.rule,
            },
          ]}
        >
          <Text
            style={[
              styles.departChoiceText,
              { color: isLeaveNow ? "#FFFFFF" : colors.fg },
            ]}
          >
            {s.leaveNow}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !isLeaveNow }}
          onPress={openTimePicker}
          style={[
            styles.departChoiceBtn,
            {
              backgroundColor: !isLeaveNow ? colors.accent : colors.bg,
              borderColor: !isLeaveNow ? colors.accent : colors.rule,
            },
          ]}
        >
          <Text
            style={[
              styles.departChoiceText,
              { color: !isLeaveNow ? "#FFFFFF" : colors.fg },
            ]}
          >
            {customDepartMs !== null
              ? `${s.leaveLater}: ${formatClock(customDepartMs)}`
              : s.leaveLater}
          </Text>
        </Pressable>
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
                  {formatTransfers(engine, r.xf)} ·{" "}
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
            · {formatStops(engine, route.stops)}
          </Text>
        </View>
      </View>

      {[from, to].map((tok) => {
        const parsed = engine.parseToken(tok);
        const lm = parsed?.lm;
        if (!lm) return null;
        const details = formatPlaceDetails(
          engine,
          { st: parsed!.st, min: lm.min, note: lm.note },
          false,
        );
        if (!details) return null;
        return (
          <View
            key={`lm-${tok}`}
            style={[
              styles.placeNoteBox,
              { backgroundColor: colors.bg, borderColor: colors.rule },
            ]}
          >
            <Text style={[styles.placeNoteText, txt]}>
              {engine.name(tok)}: {details}
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
                      style={[
                        styles.rideStopsSummary,
                        txt,
                        { color: colors.muted },
                      ]}
                    >
                      {formatStops(engine, leg.stops.length - 1)}
                      {leg.t ? ` · ${formatMinutes(engine, leg.t)}` : ""}{" "}
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
                {leg.type === "xfer"
                  ? formatTransferStepLabel(engine)
                  : s.walking}{" "}
                · {leg.from ? engine.stationName(leg.from) : ""} ·{" "}
                {formatMinutes(engine, leg.t ?? 3)}
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

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setPickerVisible(false)}
          />
          <View
            style={[
              styles.pickerSheet,
              { backgroundColor: colors.surface, borderColor: colors.rule },
            ]}
          >
            <View style={[styles.pickerHeader, rowDir]}>
              <Text style={[styles.pickerTitle, txtBold]}>
                {s.leaveLater} ({ String(pickedHour).padStart(2, "0") }:
                { String(pickedMinute).padStart(2, "0") })
              </Text>
              <Pressable
                onPress={() => setPickerVisible(false)}
                style={[styles.pickerClose, { backgroundColor: colors.bg }]}
              >
                <Text style={{ color: colors.fg, fontWeight: "700" }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerScroll}
            >
              {HOURS.map((h) => {
                const active = h === pickedHour;
                return (
                  <Pressable
                    key={`h-${h}`}
                    onPress={() => setPickedHour(h)}
                    style={[
                      styles.timeCell,
                      {
                        backgroundColor: active ? colors.accent : colors.bg,
                        borderColor: active ? colors.accent : colors.rule,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? "#FFFFFF" : colors.fg,
                        fontWeight: "700",
                      }}
                    >
                      {String(h).padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerScroll}
            >
              {MINUTES.map((m) => {
                const active = m === pickedMinute;
                return (
                  <Pressable
                    key={`m-${m}`}
                    onPress={() => setPickedMinute(m)}
                    style={[
                      styles.timeCell,
                      {
                        backgroundColor: active ? colors.accent : colors.bg,
                        borderColor: active ? colors.accent : colors.rule,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? "#FFFFFF" : colors.fg,
                        fontWeight: "700",
                      }}
                    >
                      :{String(m).padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.actionsRow, rowDir]}>
              <Pressable
                onPress={() => {
                  onChangeCustomDepartMs(null);
                  setPickerVisible(false);
                }}
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.bg, borderColor: colors.rule },
                ]}
              >
                <Text style={[styles.actionBtnText, { color: colors.fg }]}>
                  {s.leaveNow}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => applyPickedTime(pickedHour, pickedMinute)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
              >
                <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>
                  OK ({String(pickedHour).padStart(2, "0")}:
                  {String(pickedMinute).padStart(2, "0")})
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  departButtonsRow: {
    gap: 8,
  },
  departChoiceBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  departChoiceText: {
    fontSize: 13,
    fontWeight: "700",
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
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalDismiss: {
    ...StyleSheet.absoluteFill,
  },
  pickerSheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  pickerHeader: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  pickerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  timeCell: {
    minWidth: 46,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
});
