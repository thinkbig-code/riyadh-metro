import React, { forwardRef, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { MetroEngine, Route } from "../core/metro";
import { getAppStrings } from "../i18n";
import { AppTheme, directionalRow, directionalText } from "../theme";
import type { SavedTrip } from "./MenuSheet";
import RouteSheetContent from "./RouteSheetContent";
import SearchView from "./SearchView";

export interface BottomPanelProps {
  engine: MetroEngine;
  language: string;
  rtl: boolean;
  theme: AppTheme;
  from: string;
  to: string;
  routes: Route[];
  selectedOption: number;
  onSelectOption: (idx: number) => void;
  activeField: "from" | "to" | null;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  onPressField: (field: "from" | "to") => void;
  onSelectSearchToken: (token: string) => void;
  onSelectTrip: (trip: SavedTrip) => void;
  onUseLocation: () => void;
  onCloseSearch: () => void;
  onSwap: () => void;
  onClear: () => void;
  departMs: number;
  departOffsetMin: number;
  onChangeDepartOffsetMin: (offsetMinutes: number) => void;
  isCurrentRouteSaved: boolean;
  onToggleSaveRoute: () => void;
  onShareRoute: () => void;
  recent: SavedTrip[];
  onSheetChange?: (index: number) => void;
}

const BottomPanel = forwardRef<BottomSheet, BottomPanelProps>(
  function BottomPanel(
    {
      engine,
      language,
      rtl,
      theme,
      from,
      to,
      routes,
      selectedOption,
      onSelectOption,
      activeField,
      searchQuery,
      onChangeSearchQuery,
      onPressField,
      onSelectSearchToken,
      onSelectTrip,
      onUseLocation,
      onCloseSearch,
      onSwap,
      onClear,
      departMs,
      departOffsetMin,
      onChangeDepartOffsetMin,
      isCurrentRouteSaved,
      onToggleSaveRoute,
      onShareRoute,
      recent,
      onSheetChange,
    },
    ref,
  ) {
    const snapPoints = useMemo(() => ["18%", "48%", "88%"], []);
    const { colors } = theme;
    const t = engine.text;
    const s = getAppStrings(language);
    const txt = directionalText(rtl, theme, false);
    const txtBold = directionalText(rtl, theme, true);
    const rowDir = directionalRow(rtl);

    const activeRoute =
      routes.length > 0
        ? routes[Math.min(selectedOption, routes.length - 1)]
        : null;

    const handleChange = useCallback(
      (index: number) => {
        if (onSheetChange) onSheetChange(index);
      },
      [onSheetChange],
    );

    return (
      <BottomSheet
        ref={ref}
        index={0}
        snapPoints={snapPoints}
        onChange={handleChange}
        enablePanDownToClose={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        backgroundStyle={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: 1,
          borderColor: colors.rule,
        }}
        handleIndicatorStyle={{
          backgroundColor: colors.muted,
          width: 40,
          height: 4,
        }}
      >
        <View style={styles.peekHeader}>
          <View style={[styles.fieldsRow, rowDir]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("phFrom")}
              onPress={() => onPressField("from")}
              style={[
                styles.fieldBox,
                rowDir,
                {
                  backgroundColor: colors.bg,
                  borderColor:
                    activeField === "from"
                      ? colors.accent
                      : from
                        ? colors.accent
                        : colors.rule,
                },
              ]}
            >
              <View
                style={[
                  styles.fieldDot,
                  { backgroundColor: from ? colors.accent : colors.muted },
                ]}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.fieldText,
                  from ? txtBold : txt,
                  { color: from ? colors.fg : colors.muted },
                ]}
              >
                {from ? engine.name(from) : t("phFrom")}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("swap")}
              onPress={onSwap}
              style={[
                styles.swapButton,
                { backgroundColor: colors.bg, borderColor: colors.rule },
              ]}
            >
              <Text style={[styles.swapIcon, { color: colors.fg }]}>⇄</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("phTo")}
              onPress={() => onPressField("to")}
              style={[
                styles.fieldBox,
                rowDir,
                {
                  backgroundColor: colors.bg,
                  borderColor:
                    activeField === "to"
                      ? colors.danger
                      : to
                        ? colors.danger
                        : colors.rule,
                },
              ]}
            >
              <View
                style={[
                  styles.fieldDot,
                  { backgroundColor: to ? colors.danger : colors.muted },
                ]}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.fieldText,
                  to ? txtBold : txt,
                  { color: to ? colors.fg : colors.muted },
                ]}
              >
                {to ? engine.name(to) : t("phTo")}
              </Text>
            </Pressable>

            {(from !== "" || to !== "") && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("clear")}
                onPress={onClear}
                style={[
                  styles.clearButton,
                  { backgroundColor: colors.bg, borderColor: colors.rule },
                ]}
              >
                <Text style={[styles.clearIcon, { color: colors.muted }]}>
                  ✕
                </Text>
              </Pressable>
            )}
          </View>

          {activeRoute && !activeField && (
            <View style={[styles.quickSummaryRow, rowDir]}>
              <Text style={[styles.quickTime, txtBold]}>
                {t("minRange", {
                  a: activeRoute.time,
                  b: activeRoute.timeMax,
                })}
              </Text>
              <Text style={[styles.quickMeta, txt, { color: colors.muted }]}>
                {t("changes", { n: activeRoute.xf })} ·{" "}
                {activeRoute.rides ? `${engine.fares.std} SAR` : "0 SAR"}
              </Text>
            </View>
          )}
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          {activeField ? (
            <SearchView
              engine={engine}
              language={language}
              rtl={rtl}
              theme={theme}
              activeField={activeField}
              query={searchQuery}
              onChangeQuery={onChangeSearchQuery}
              onSelectToken={onSelectSearchToken}
              onSelectTrip={onSelectTrip}
              onUseLocation={onUseLocation}
              onCloseSearch={onCloseSearch}
              recent={recent}
            />
          ) : activeRoute ? (
            <RouteSheetContent
              engine={engine}
              language={language}
              rtl={rtl}
              theme={theme}
              from={from}
              to={to}
              routes={routes}
              selectedOption={selectedOption}
              onSelectOption={onSelectOption}
              departMs={departMs}
              departOffsetMin={departOffsetMin}
              onChangeDepartOffsetMin={onChangeDepartOffsetMin}
              isSaved={isCurrentRouteSaved}
              onToggleSave={onToggleSaveRoute}
              onShare={onShareRoute}
            />
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyHint, txt, { color: colors.muted }]}>
                {from && to && from === to ? t("hintSame") : s.pullUpHint}
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  peekHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  fieldsRow: {
    alignItems: "center",
    gap: 6,
  },
  fieldBox: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 8,
  },
  fieldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fieldText: {
    flex: 1,
    fontSize: 14,
  },
  swapButton: {
    width: 40,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  swapIcon: {
    fontSize: 17,
    fontWeight: "700",
  },
  clearButton: {
    width: 36,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clearIcon: {
    fontSize: 14,
    fontWeight: "700",
  },
  quickSummaryRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  quickTime: {
    fontSize: 16,
    fontWeight: "700",
  },
  quickMeta: {
    fontSize: 13,
  },
  sheetContent: {
    paddingHorizontal: 14,
    paddingBottom: 32,
  },
  emptyWrap: {
    paddingVertical: 18,
  },
  emptyHint: {
    fontSize: 14,
  },
});

export default BottomPanel;
