import rawGeometry from "../core/mapGeometry.json";
import type { Leg, Route } from "../core/metro";

export type LineColorKey = "blue" | "red" | "orange" | "yellow" | "green" | "purple";
export type LabelSide = "l" | "r" | "t" | "b" | "tl" | "br";
export type ThemeMode = "light" | "dark";
export type ZoomTier = "far" | "normal" | "close";

export interface ThemePalette {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  rule: string;
  blue: string;
  red: string;
  orange: string;
  yellow: string;
  green: string;
  purple: string;
  water: string;
}

export interface MapStation {
  id: string;
  x: number;
  y: number;
  side: LabelSide;
  en: string;
  ar: string;
  former: string[];
  lines: LineColorKey[];
  interchange: boolean;
  terminus: boolean;
  walkTo: string | null;
  number: number;
  labelEn: string[];
}

export interface MapLine {
  id: LineColorKey;
  service: string;
  number: number;
  stops: string[];
  parts: [number, number][][];
}

export interface MapGeometry {
  generatedFrom: string;
  sourceSha256: string;
  box: { x0: number; y0: number; x1: number; y1: number };
  colors: { light: ThemePalette; dark: ThemePalette };
  stations: MapStation[];
  lines: MapLine[];
  sharedSection: {
    stops: string[];
    lines: LineColorKey[];
    offset: number;
  };
  wadi: {
    points: [number, number][];
    label: { en: string; ar: string; x: number; y: number };
  };
  districts: { en: string; ar: string; x: number; y: number }[];
}

export interface RouteHighlightInput {
  stations?: string[];
  legs: Leg[];
  from?: string;
  to?: string;
}

export interface LineBadgePlacement {
  key: string;
  lineId: LineColorKey;
  number: number;
  x: number;
  y: number;
  primary: boolean;
}

export interface RouteRenderData {
  stationIds: Set<string>;
  ridePaths: { key: string; lineId: LineColorKey; d: string }[];
  walkSegments: { key: string; x1: number; y1: number; x2: number; y2: number }[];
  startStation: MapStation | null;
  endStation: MapStation | null;
}

export interface LandmarkPictogram {
  id: string;
  kind: "tower" | "faisaliah" | "fort" | "museum" | "stadium" | "boulevard";
  x: number;
  y: number;
  en: string;
  ar: string;
}

export const MAP_GEOMETRY = rawGeometry as unknown as MapGeometry;

export const STATION_BY_ID: Record<string, MapStation> = Object.fromEntries(
  MAP_GEOMETRY.stations.map((s) => [s.id, s]),
);

export const LINE_BY_ID: Record<LineColorKey, MapLine> = Object.fromEntries(
  MAP_GEOMETRY.lines.map((l) => [l.id, l]),
) as Record<LineColorKey, MapLine>;

export const LINE_BY_SERVICE: Record<string, MapLine> = Object.fromEntries(
  MAP_GEOMETRY.lines.map((l) => [l.service, l]),
);

export function pointsToSvgPath(points: [number, number][]): string {
  if (!points.length) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]} ${points[i][1]}`;
  }
  return d;
}

export function pointsToSmoothSvgPath(points: [number, number][]): string {
  if (points.length < 2) return pointsToSvgPath(points);
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export const WADI_SVG_PATH = pointsToSmoothSvgPath(MAP_GEOMETRY.wadi.points);

export const PRECOMPUTED_LINE_PATHS: {
  key: string;
  lineId: LineColorKey;
  number: number;
  d: string;
}[] = MAP_GEOMETRY.lines.flatMap((line) =>
  line.parts.map((part, idx) => ({
    key: `${line.id}-${idx}`,
    lineId: line.id,
    number: line.number,
    d: pointsToSvgPath(part),
  })),
);

export const LINE_BADGES: LineBadgePlacement[] = [
  { key: "b-1-start", lineId: "blue", number: 1, x: 318, y: 278, primary: true },
  { key: "b-1-mid", lineId: "blue", number: 1, x: 440, y: 898, primary: false },
  { key: "b-1-end", lineId: "blue", number: 1, x: 612, y: 1172, primary: true },

  { key: "b-2-start", lineId: "red", number: 2, x: 278, y: 672, primary: true },
  { key: "b-2-mid", lineId: "red", number: 2, x: 532, y: 510, primary: false },
  { key: "b-2-end", lineId: "red", number: 2, x: 940, y: 350, primary: true },

  { key: "b-3-start", lineId: "orange", number: 3, x: 20, y: 1158, primary: true },
  { key: "b-3-mid1", lineId: "orange", number: 3, x: 318, y: 1042, primary: false },
  { key: "b-3-mid2", lineId: "orange", number: 3, x: 652, y: 902, primary: false },
  { key: "b-3-end", lineId: "orange", number: 3, x: 972, y: 583, primary: true },

  { key: "b-4-start", lineId: "yellow", number: 4, x: 486, y: 306, primary: true },
  { key: "b-4-end", lineId: "yellow", number: 4, x: 680, y: 50, primary: true },

  { key: "b-5-start", lineId: "green", number: 5, x: 630, y: 480, primary: true },
  { key: "b-5-end", lineId: "green", number: 5, x: 525, y: 835, primary: true },

  { key: "b-6-start", lineId: "purple", number: 6, x: 562, y: 352, primary: true },
  { key: "b-6-mid", lineId: "purple", number: 6, x: 880, y: 585, primary: false },
  { key: "b-6-end", lineId: "purple", number: 6, x: 880, y: 704, primary: true },
];

export const LANDMARK_PICTOGRAMS: LandmarkPictogram[] = [
  { id: "lm-kingdom", kind: "tower", x: 395, y: 600, en: "Kingdom Centre", ar: "برج المملكة" },
  { id: "lm-faisaliah", kind: "faisaliah", x: 400, y: 675, en: "Al Faisaliah", ar: "برج الفيصلية" },
  { id: "lm-masmak", kind: "fort", x: 472, y: 948, en: "Al Masmak", ar: "قصر المصمك" },
  { id: "lm-museum", kind: "museum", x: 482, y: 855, en: "National Museum", ar: "المتحف الوطني" },
  { id: "lm-stadium", kind: "stadium", x: 965, y: 345, en: "King Fahad Stadium", ar: "استاد الملك فهد" },
  { id: "lm-boulevard", kind: "boulevard", x: 285, y: 345, en: "Boulevard", ar: "بوليفارد" },
];

function resolveLineForService(svc: string): MapLine | undefined {
  if (LINE_BY_SERVICE[svc]) return LINE_BY_SERVICE[svc];
  const lower = svc.toLowerCase() as LineColorKey;
  if (LINE_BY_ID[lower]) return LINE_BY_ID[lower];
  const digits = svc.replace(/\D/g, "");
  return digits ? LINE_BY_SERVICE[digits] : undefined;
}

function sliceLinePartsForStops(line: MapLine, stopIds: string[]): string[] {
  if (stopIds.length < 2) return [];
  const paths: string[] = [];

  for (const part of line.parts) {
    const matchedIndices: number[] = [];
    for (const sid of stopIds) {
      const st = STATION_BY_ID[sid];
      if (!st) continue;
      let bestIdx = -1;
      let bestDist = 6.0;
      for (let i = 0; i < part.length; i++) {
        const d = Math.hypot(st.x - part[i][0], st.y - part[i][1]);
        if (d <= bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx !== -1) matchedIndices.push(bestIdx);
    }

    if (matchedIndices.length >= 2) {
      const i0 = Math.min(...matchedIndices);
      const i1 = Math.max(...matchedIndices);
      const sub = part.slice(i0, i1 + 1);
      if (sub.length >= 2) {
        paths.push(pointsToSvgPath(sub));
      }
    }
  }

  if (paths.length === 0) {
    const coords = stopIds
      .map((id) => STATION_BY_ID[id])
      .filter((s): s is MapStation => Boolean(s))
      .map((s): [number, number] => [s.x, s.y]);
    if (coords.length >= 2) {
      paths.push(pointsToSvgPath(coords));
    }
  }

  return paths;
}

export function buildRouteRenderData(
  routeInput?: RouteHighlightInput | Route | null,
): RouteRenderData | null {
  if (!routeInput || !routeInput.legs || routeInput.legs.length === 0) {
    return null;
  }

  const stationIds = new Set<string>();
  if ("stations" in routeInput && Array.isArray(routeInput.stations)) {
    for (const sid of routeInput.stations) {
      if (STATION_BY_ID[sid]) stationIds.add(sid);
    }
  }

  const ridePaths: { key: string; lineId: LineColorKey; d: string }[] = [];
  const walkSegments: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  let firstStationId: string | undefined =
    "from" in routeInput && routeInput.from && STATION_BY_ID[routeInput.from]
      ? routeInput.from
      : undefined;
  let lastStationId: string | undefined =
    "to" in routeInput && routeInput.to && STATION_BY_ID[routeInput.to]
      ? routeInput.to
      : undefined;

  routeInput.legs.forEach((leg, legIndex) => {
    if (leg.stops) {
      for (const sid of leg.stops) {
        if (STATION_BY_ID[sid]) {
          stationIds.add(sid);
          if (!firstStationId) firstStationId = sid;
          lastStationId = sid;
        }
      }
    }
    if (leg.from && STATION_BY_ID[leg.from]) {
      stationIds.add(leg.from);
      if (!firstStationId) firstStationId = leg.from;
    }
    if (leg.to && STATION_BY_ID[leg.to]) {
      stationIds.add(leg.to);
      lastStationId = leg.to;
    }

    if (leg.type === "ride" && leg.stops && leg.stops.length >= 2) {
      const line = resolveLineForService(leg.svc);
      const lineId: LineColorKey = line ? line.id : "blue";
      const dList = line
        ? sliceLinePartsForStops(line, leg.stops)
        : [
            pointsToSvgPath(
              leg.stops
                .map((id) => STATION_BY_ID[id])
                .filter((s): s is MapStation => Boolean(s))
                .map((s): [number, number] => [s.x, s.y]),
            ),
          ];
      dList.forEach((d, subIdx) => {
        if (d) {
          ridePaths.push({
            key: `ride-${legIndex}-${subIdx}`,
            lineId,
            d,
          });
        }
      });
    } else if ((leg.type === "walk" || leg.type === "xfer") && leg.from && leg.to) {
      const s1 = STATION_BY_ID[leg.from];
      const s2 = STATION_BY_ID[leg.to];
      if (s1 && s2 && (s1.x !== s2.x || s1.y !== s2.y)) {
        walkSegments.push({
          key: `walk-${legIndex}`,
          x1: s1.x,
          y1: s1.y,
          x2: s2.x,
          y2: s2.y,
        });
      }
    }
  });

  if (stationIds.size === 0) return null;

  return {
    stationIds,
    ridePaths,
    walkSegments,
    startStation: firstStationId ? STATION_BY_ID[firstStationId] || null : null,
    endStation: lastStationId ? STATION_BY_ID[lastStationId] || null : null,
  };
}
