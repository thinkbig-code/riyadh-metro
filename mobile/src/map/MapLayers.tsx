import React, { memo } from "react";
import { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import {
  LANDMARK_PICTOGRAMS,
  LINE_BADGES,
  MAP_GEOMETRY,
  MapStation,
  PRECOMPUTED_LINE_PATHS,
  RouteRenderData,
  STATION_BY_ID,
  ThemeMode,
  ThemePalette,
  WADI_SVG_PATH,
  ZoomTier,
} from "./geometry";
import { getAllStationLabels, StationLabelLayout } from "./labels";

const AIRPORT_STATION_IDS = new Set(["t12", "t34", "t5"]);

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
  zoomTier,
  fontBold,
}: BaseLayerProps & { zoomTier: ZoomTier }) {
  if (zoomTier === "far") return null;
  const isAr = language === "ar" || language === "ur";
  return (
    <G opacity={zoomTier === "close" ? 0.38 : 0.25}>
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

export const LandmarksLayer = memo(function LandmarksLayer({
  palette,
  zoomTier,
}: {
  palette: ThemePalette;
  zoomTier: ZoomTier;
}) {
  if (zoomTier === "far") return null;
  const stroke = palette.muted;
  return (
    <G opacity={0.35}>
      {LANDMARK_PICTOGRAMS.map((lm) => {
        const { x, y, kind } = lm;
        if (kind === "tower") {
          return (
            <Path
              key={lm.id}
              d={`M ${x - 4} ${y + 7} L ${x - 4} ${y - 5} L ${x - 2} ${y - 8} L ${x} ${y - 4} L ${x + 2} ${y - 8} L ${x + 4} ${y - 5} L ${x + 4} ${y + 7} Z`}
              stroke={stroke}
              strokeWidth={1.3}
              fill="none"
            />
          );
        }
        if (kind === "faisaliah") {
          return (
            <G key={lm.id}>
              <Path
                d={`M ${x - 4} ${y + 7} L ${x} ${y - 9} L ${x + 4} ${y + 7} Z`}
                stroke={stroke}
                strokeWidth={1.3}
                fill="none"
              />
              <Circle cx={x} cy={y - 3} r={1.8} fill={stroke} />
            </G>
          );
        }
        if (kind === "fort" || kind === "museum") {
          return (
            <Path
              key={lm.id}
              d={`M ${x - 6} ${y + 5} L ${x - 6} ${y - 4} L ${x - 3} ${y - 4} L ${x - 3} ${y - 2} L ${x + 3} ${y - 2} L ${x + 3} ${y - 4} L ${x + 6} ${y - 4} L ${x + 6} ${y + 5} Z`}
              stroke={stroke}
              strokeWidth={1.3}
              fill="none"
            />
          );
        }
        return (
          <Rect
            key={lm.id}
            x={x - 6}
            y={y - 4}
            width={12}
            height={8}
            rx={4}
            stroke={stroke}
            strokeWidth={1.3}
            fill="none"
          />
        );
      })}
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
  zoomTier,
  dimmed,
  fontBold,
}: {
  palette: ThemePalette;
  zoomTier: ZoomTier;
  dimmed: boolean;
  fontBold?: string;
}) {
  const badgeRadius = zoomTier === "far" ? 12.5 : 9.5;
  const fontSize = zoomTier === "far" ? 13 : 10.5;

  return (
    <G opacity={dimmed ? 0.25 : 1}>
      {LINE_BADGES.map((b) => {
        const bg = palette[b.lineId];
        const fg = b.lineId === "yellow" ? "#18212A" : "#FFFFFF";
        return (
          <G key={b.key}>
            <Circle
              cx={b.x}
              cy={b.y}
              r={badgeRadius}
              fill={bg}
              stroke={palette.bg}
              strokeWidth={2}
            />
            <SvgText
              x={b.x}
              y={b.y + fontSize * 0.35}
              fill={fg}
              fontSize={fontSize}
              fontWeight="700"
              fontFamily={fontBold}
              textAnchor="middle"
            >
              {String(b.number)}
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
      {MAP_GEOMETRY.stations
        .filter((s) => AIRPORT_STATION_IDS.has(s.id) || s.id === "railway")
        .map((s) => {
          const hx = s.x - 13;
          const hy = s.y;
          if (s.id === "railway") {
            return (
              <Rect
                key={`hub-${s.id}`}
                x={hx - 4}
                y={hy - 4}
                width={8}
                height={8}
                rx={2}
                stroke={palette.muted}
                strokeWidth={1.5}
                fill={palette.surface}
              />
            );
          }
          return (
            <Path
              key={`hub-${s.id}`}
              d={`M ${hx - 4} ${hy} L ${hx + 4} ${hy} M ${hx} ${hy - 4} L ${hx + 2} ${hy} L ${hx} ${hy + 4}`}
              stroke={palette.muted}
              strokeWidth={1.5}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
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
              strokeWidth={3.6}
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
  zoomTier,
  activeStationIds,
  fontRegular,
  fontBold,
}: {
  palette: ThemePalette;
  language: string;
  zoomTier: ZoomTier;
  activeStationIds: Set<string> | null;
  fontRegular?: string;
  fontBold?: string;
}) {
  const allLabels = getAllStationLabels(language);
  const visibleLabels =
    zoomTier === "far"
      ? allLabels.filter((l) => l.isMajor || activeStationIds?.has(l.id))
      : allLabels;

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
