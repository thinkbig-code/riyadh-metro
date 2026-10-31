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
  const visibleBadges = useMemo(
    () => getNonCollidingLineBadges(language, renderScale, activeStationIds),
    [activeStationIds, language, renderScale],
  );

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

function renderHubBadge(
  stationId: string,
  kind: "plane" | "train",
  x: number,
  y: number,
  palette: ThemePalette,
) {
  const size = 16;
  const half = size / 2;
  return (
    <G key={`hub-${stationId}`} transform={`translate(${x}, ${y})`}>
      <Rect
        x={-half}
        y={-half}
        width={size}
        height={size}
        rx={4.5}
        fill={palette.surface}
        stroke={palette.muted}
        strokeWidth={1.1}
      />
      {kind === "plane" ? (
        <Path
          d="M -0.8 -5.2 C -0.8 -5.8 0.8 -5.8 0.8 -5.2 L 0.9 -1.6 L 5.2 0.8 L 5.2 2.0 L 0.9 0.7 L 0.8 3.5 L 2.6 4.7 L 2.6 5.6 L 0 4.9 L -2.6 5.6 L -2.6 4.7 L -0.8 3.5 L -0.9 0.7 L -5.2 2.0 L -5.2 0.8 L -0.9 -1.6 Z"
          fill={palette.fg}
        />
      ) : (
        <G>
          <Path
            d="M -3.8 -4.8 C -3.8 -5.4 -2.2 -5.8 0 -5.8 C 2.2 -5.8 3.8 -5.4 3.8 -4.8 L 4.2 1.8 C 4.2 2.8 3.4 3.5 2.4 3.5 L 3.8 5.5 L 2.3 5.5 L 1.1 3.5 L -1.1 3.5 L -2.3 5.5 L -3.8 5.5 L -2.4 3.5 C -3.4 3.5 -4.2 2.8 -4.2 1.8 Z"
            fill={palette.fg}
          />
          <Rect
            x={-2.7}
            y={-3.8}
            width={5.4}
            height={2.6}
            rx={0.8}
            fill={palette.surface}
          />
          <Circle cx={-1.8} cy={1.4} r={0.85} fill={palette.surface} />
          <Circle cx={1.8} cy={1.4} r={0.85} fill={palette.surface} />
        </G>
      )}
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
        renderHubBadge(hub.stationId, hub.kind, hub.x, hub.y, palette),
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
  const visibleLabels = useMemo(
    () => getVisibleStationLabels(language, renderScale, activeStationIds),
    [activeStationIds, language, renderScale],
  );

  return (
    <G>
      {visibleLabels.map((lbl) => {
        const isHighlighted = !activeStationIds || activeStationIds.has(lbl.id);
        return (
          <G key={lbl.id} opacity={isHighlighted ? 1 : 0.25}>
            {renderLabelNode(lbl, palette, fontRegular, fontBold)}
          </G>
        );
      })}
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
