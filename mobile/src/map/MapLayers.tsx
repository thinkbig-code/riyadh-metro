import React, { memo, useMemo } from "react";
import { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import {
  HUB_ICONS,
  MAP_GEOMETRY,
  MapStation,
  PRECOMPUTED_LINE_PATHS,
  RouteRenderData,
  STATION_BY_ID,
  ThemeMode,
  ThemePalette,
  WADI_SVG_PATH,
} from "./geometry";
import {
  FAR_ZOOM_THRESHOLD,
  getNonCollidingLineBadges,
  getVisibleStationLabels,
  StationLabelLayout,
} from "./labels";

// Label and badge layout (collision checks against every line and label) is the expensive part of a
// render. Compute it once per language and zoom step and keep it, so selecting a route or the minute
// clock never recomputes it (that made "To here" take seconds on a phone).
const labelCache = new Map<string, ReturnType<typeof getVisibleStationLabels>>();
const badgeCache = new Map<string, ReturnType<typeof getNonCollidingLineBadges>>();
function cachedLabels(language: string, renderScale: number) {
  const key = `${language}:${renderScale}`;
  let v = labelCache.get(key);
  if (!v) {
    v = getVisibleStationLabels(language, renderScale, null);
    labelCache.set(key, v);
  }
  return v;
}
function cachedBadges(language: string, renderScale: number) {
  const key = `${language}:${renderScale}`;
  let v = badgeCache.get(key);
  if (!v) {
    v = getNonCollidingLineBadges(language, renderScale, null);
    badgeCache.set(key, v);
  }
  return v;
}

interface BaseLayerProps {
  palette: ThemePalette;
  theme: ThemeMode;
  language: string;
  fontRegular?: string;
  fontBold?: string;
}

export const WadiLayer = memo(function WadiLayer({
  palette,
  language,
  fontRegular,
}: BaseLayerProps) {
  const isAr = language === "ar" || language === "ur";
  const label = isAr ? MAP_GEOMETRY.wadi.label.ar : MAP_GEOMETRY.wadi.label.en;
  return (
    <G>
      <Path
        d={WADI_SVG_PATH}
        stroke={palette.water}
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.75}
      />
      <SvgText
        x={MAP_GEOMETRY.wadi.label.x}
        y={MAP_GEOMETRY.wadi.label.y}
        fill={palette.muted}
        opacity={0.65}
        fontSize={11}
        fontFamily={fontRegular}
        textAnchor="middle"
        transform={`rotate(-78, ${MAP_GEOMETRY.wadi.label.x}, ${MAP_GEOMETRY.wadi.label.y})`}
      >
        {label}
      </SvgText>
    </G>
  );
});

export const DistrictsLayer = memo(function DistrictsLayer({
  palette,
  language,
  renderScale,
  fontBold,
}: BaseLayerProps & { renderScale: number }) {
  if (renderScale < FAR_ZOOM_THRESHOLD) return null;
  const isAr = language === "ar" || language === "ur";
  return (
    <G opacity={renderScale >= 1.25 ? 0.36 : 0.24}>
      {MAP_GEOMETRY.districts.map((d) => (
        <SvgText
          key={d.en}
          x={d.x}
          y={d.y}
          fill={palette.muted}
          fontSize={13}
          fontWeight="700"
          fontFamily={fontBold}
          letterSpacing={1.4}
          textAnchor="middle"
        >
          {isAr ? d.ar : d.en}
        </SvgText>
      ))}
    </G>
  );
});

export const LinesLayer = memo(function LinesLayer({
  palette,
  dimmed,
}: {
  palette: ThemePalette;
  dimmed: boolean;
}) {
  return (
    <G opacity={dimmed ? 0.24 : 1}>
      {PRECOMPUTED_LINE_PATHS.map((seg) => (
        <Path
          key={seg.key}
          d={seg.d}
          stroke={palette[seg.lineId]}
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </G>
  );
});

export const BadgesLayer = memo(function BadgesLayer({
  palette,
  language,
  renderScale,
  activeStationIds,
  dimmed,
  fontBold,
}: {
  palette: ThemePalette;
  language: string;
  renderScale: number;
  activeStationIds: Set<string> | null;
  dimmed: boolean;
  fontBold?: string;
}) {
  // layout depends only on language and zoom, never on the route (a route only changes opacity)
  const visibleBadges = useMemo(() => cachedBadges(language, renderScale), [language, renderScale]);

  return (
    <G opacity={dimmed ? 0.25 : 1}>
      {visibleBadges.map(({ badge, radius, fontSize }) => {
        const bg = palette[badge.lineId];
        const fg = badge.lineId === "yellow" ? "#18212A" : "#FFFFFF";
        return (
          <G key={badge.key}>
            <Circle
              cx={badge.x}
              cy={badge.y}
              r={radius}
              fill={bg}
              stroke={palette.bg}
              strokeWidth={2}
            />
            <SvgText
              x={badge.x}
              y={badge.y + fontSize * 0.35}
              fill={fg}
              fontSize={fontSize}
              fontWeight="700"
              fontFamily={fontBold}
              textAnchor="middle"
            >
              {String(badge.number)}
            </SvgText>
          </G>
        );
      })}
    </G>
  );
});

function renderSingleStation(
  station: MapStation,
  palette: ThemePalette,
  theme: ThemeMode,
) {
  const { x, y, interchange, terminus, lines } = station;

  if (interchange) {
    const count = lines.length;
    const spacing = 8.2;
    const pillWidth = (count - 1) * spacing + 14.5;
    const pillHeight = 14.5;
    const fill = theme === "light" ? "#FFFFFF" : "#222D38";
    const stroke = theme === "light" ? "#18212A" : "#E6ECF0";

    return (
      <G key={station.id}>
        <Rect
          x={x - pillWidth / 2}
          y={y - pillHeight / 2}
          width={pillWidth}
          height={pillHeight}
          rx={pillHeight / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={2.2}
        />
        {lines.map((lineId, idx) => {
          const cx = x - ((count - 1) * spacing) / 2 + idx * spacing;
          return (
            <Circle
              key={`${station.id}-${lineId}`}
              cx={cx}
              cy={y}
              r={3.5}
              fill={palette[lineId]}
            />
          );
        })}
      </G>
    );
  }

  const lineColor = palette[lines[0] || "blue"];
  if (terminus) {
    const innerFill = theme === "light" ? "#FFFFFF" : "#18212A";
    return (
      <G key={station.id}>
        <Circle
          cx={x}
          cy={y}
          r={6.8}
          fill={innerFill}
          stroke={lineColor}
          strokeWidth={3.4}
        />
        <Circle cx={x} cy={y} r={2.6} fill={lineColor} />
      </G>
    );
  }

  const dotFill = theme === "light" ? "#FFFFFF" : "#10161C";
  return (
    <Circle
      key={station.id}
      cx={x}
      cy={y}
      r={4.8}
      fill={dotFill}
      stroke={lineColor}
      strokeWidth={2.6}
    />
  );
}

// Pictograms on a 24-unit grid (Material Design icons "flight" and "train", Apache License 2.0).
const PLANE_D =
  "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";
const TRAIN_D =
  "M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z";
export const HUB_RADIUS = 13;

function renderHubBadge(
  stationId: string,
  kind: "plane" | "train",
  x: number,
  y: number,
  palette: ThemePalette,
  theme: ThemeMode,
) {
  // a solid round sign: dark disc with a white pictogram in the light theme, the reverse in dark
  const disc = theme === "light" ? "#18212A" : "#E6ECF0";
  const glyph = theme === "light" ? "#FFFFFF" : "#18212A";
  const k = 0.78; // pictogram 24 * 0.78 = about 19 units inside a 26-unit disc
  return (
    <G key={`hub-${stationId}`}>
      <Circle cx={x} cy={y} r={HUB_RADIUS + 1.8} fill={palette.bg} />
      <Circle cx={x} cy={y} r={HUB_RADIUS} fill={disc} />
      <Path
        d={kind === "plane" ? PLANE_D : TRAIN_D}
        fill={glyph}
        transform={`translate(${x - 12 * k}, ${y - 12 * k}) scale(${k})`}
      />
    </G>
  );
}

export const StationsLayer = memo(function StationsLayer({
  palette,
  theme,
  dimmed,
}: {
  palette: ThemePalette;
  theme: ThemeMode;
  dimmed: boolean;
}) {
  return (
    <G opacity={dimmed ? 0.25 : 1}>
      {MAP_GEOMETRY.stations.map((station) =>
        renderSingleStation(station, palette, theme),
      )}
      {HUB_ICONS.map((hub) =>
        renderHubBadge(hub.stationId, hub.kind, hub.x, hub.y, palette, theme),
      )}
    </G>
  );
});

function renderLabelNode(
  lbl: StationLabelLayout,
  palette: ThemePalette,
  fontRegular?: string,
  fontBold?: string,
) {
  const family = lbl.isMajor ? fontBold : fontRegular;
  const weight = lbl.isMajor ? "700" : "500";
  const haloWidth = Math.max(3.6, lbl.fontSize * 0.28);
  return (
    <G key={lbl.id}>
      {lbl.lines.map((lineText, idx) => {
        const yPos = lbl.y + idx * lbl.lineHeight;
        return (
          <React.Fragment key={`${lbl.id}-${idx}`}>
            <SvgText
              x={lbl.x}
              y={yPos}
              textAnchor={lbl.anchor}
              fontSize={lbl.fontSize}
              fontWeight={weight}
              fontFamily={family}
              stroke={palette.bg}
              strokeWidth={haloWidth}
              strokeLinejoin="round"
              fill="none"
            >
              {lineText}
            </SvgText>
            <SvgText
              x={lbl.x}
              y={yPos}
              textAnchor={lbl.anchor}
              fontSize={lbl.fontSize}
              fontWeight={weight}
              fontFamily={family}
              fill={palette.fg}
            >
              {lineText}
            </SvgText>
          </React.Fragment>
        );
      })}
    </G>
  );
}

export const LabelsLayer = memo(function LabelsLayer({
  palette,
  language,
  renderScale,
  activeStationIds,
  fontRegular,
  fontBold,
}: {
  palette: ThemePalette;
  language: string;
  renderScale: number;
  activeStationIds: Set<string> | null;
  fontRegular?: string;
  fontBold?: string;
}) {
  const visibleLabels = useMemo(() => cachedLabels(language, renderScale), [language, renderScale]);

  // activeStationIds = null: every label; otherwise only the route's labels (drawn above the veil).
  // No per-label opacity: on Android each translucent group is an offscreen layer, and dozens of
  // them made every frame with a route slow.
  return (
    <G>
      {visibleLabels.map((lbl) =>
        !activeStationIds || activeStationIds.has(lbl.id) ? (
          <G key={lbl.id}>{renderLabelNode(lbl, palette, fontRegular, fontBold)}</G>
        ) : null,
      )}
    </G>
  );
});

export const RouteOverlayLayer = memo(function RouteOverlayLayer({
  palette,
  theme,
  routeData,
  fontBold,
}: {
  palette: ThemePalette;
  theme: ThemeMode;
  routeData: RouteRenderData | null;
  fontBold?: string;
}) {
  if (!routeData) return null;

  return (
    <G>
      {routeData.ridePaths.map((seg) => (
        <React.Fragment key={seg.key}>
          <Path
            d={seg.d}
            stroke={palette.bg}
            strokeWidth={20}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d={seg.d}
            stroke={palette[seg.lineId]}
            strokeWidth={15.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </React.Fragment>
      ))}
      {routeData.walkSegments.map((w) => (
        <Line
          key={w.key}
          x1={w.x1}
          y1={w.y1}
          x2={w.x2}
          y2={w.y2}
          stroke={palette.fg}
          strokeWidth={5}
          strokeDasharray="6,6"
          strokeLinecap="round"
        />
      ))}
      {Array.from(routeData.stationIds).map((sid) => {
        const st = STATION_BY_ID[sid];
        return st ? renderSingleStation(st, palette, theme) : null;
      })}
      {routeData.startStation && (
        <G>
          <Circle
            cx={routeData.startStation.x}
            cy={routeData.startStation.y}
            r={12.5}
            fill="#18212A"
            stroke="#FFFFFF"
            strokeWidth={2.5}
          />
          <SvgText
            x={routeData.startStation.x}
            y={routeData.startStation.y + 4}
            fill="#FFFFFF"
            fontSize={11}
            fontWeight="700"
            fontFamily={fontBold}
            textAnchor="middle"
          >
            A
          </SvgText>
        </G>
      )}
      {routeData.endStation &&
        routeData.endStation.id !== routeData.startStation?.id && (
          <G>
            <Circle
              cx={routeData.endStation.x}
              cy={routeData.endStation.y}
              r={12.5}
              fill="#E1251B"
              stroke="#FFFFFF"
              strokeWidth={2.5}
            />
            <SvgText
              x={routeData.endStation.x}
              y={routeData.endStation.y + 4}
              fill="#FFFFFF"
              fontSize={11}
              fontWeight="700"
              fontFamily={fontBold}
              textAnchor="middle"
            >
              B
            </SvgText>
          </G>
        )}
    </G>
  );
});

export const SelectionLayer = memo(function SelectionLayer({
  palette,
  selectedId,
}: {
  palette: ThemePalette;
  selectedId?: string | null;
}) {
  if (!selectedId) return null;
  const st = STATION_BY_ID[selectedId];
  if (!st) return null;
  const primaryColor = palette[st.lines[0] || "blue"];
  return (
    <G>
      <Circle
        cx={st.x}
        cy={st.y}
        r={16}
        fill={primaryColor}
        opacity={0.22}
      />
      <Circle
        cx={st.x}
        cy={st.y}
        r={13}
        fill="none"
        stroke={palette.fg}
        strokeWidth={2.5}
      />
    </G>
  );
});
