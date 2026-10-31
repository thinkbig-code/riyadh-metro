import { MAP_GEOMETRY, MapStation, STATION_BY_ID } from "./geometry";

export type SvgTextAnchor = "start" | "middle" | "end";

export interface StationLabelLayout {
  id: string;
  x: number;
  y: number;
  anchor: SvgTextAnchor;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  isMajor: boolean;
}

const MANUAL_OFFSETS: Record<string, { dx: number; dy: number; anchor?: SvgTextAnchor }> = {
  ishbiliyah: { dx: 4, dy: 15, anchor: "start" },
  stc: { dx: -11, dy: -11, anchor: "end" },
  hokm: { dx: -11, dy: -11, anchor: "end" },
  rabi: { dx: -10, dy: -11, anchor: "end" },
  naseem: { dx: -13, dy: -4, anchor: "end" },
};

function wrapArabicLabel(text: string, maxChars = 21): string[] {
  if (text.includes(" - ")) {
    const parts = text.split(" - ");
    return [parts[0].trim(), parts.slice(1).join(" - ").trim()];
  }
  if (text.length <= maxChars || !text.includes(" ")) {
    return [text];
  }
  const words = text.split(" ");
  let bestSplit = 1;
  let bestDiff = Number.MAX_SAFE_INTEGER;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ");
    const l2 = words.slice(i).join(" ");
    const diff = Math.abs(l1.length - l2.length);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return [words.slice(0, bestSplit).join(" "), words.slice(bestSplit).join(" ")];
}

export function getStationRadius(station: MapStation): number {
  if (station.interchange) return 10.5;
  if (station.terminus) return 6.8;
  return 5.0;
}

export function computeStationLabel(
  station: MapStation,
  language: string,
): StationLabelLayout {
  const isArabicScript = language === "ar" || language === "ur";
  const lines = isArabicScript
    ? wrapArabicLabel(station.ar)
    : station.labelEn && station.labelEn.length > 0
      ? station.labelEn
      : [station.en];

  const isMajor = station.interchange || station.terminus;
  const fontSize = isMajor ? 13.0 : 12.0;
  const lineHeight = isMajor ? 14.6 : 13.5;
  const totalHeight = lines.length * lineHeight;

  const r = getStationRadius(station);
  const gap = r + 5.5;
  const manual = MANUAL_OFFSETS[station.id];

  let anchor: SvgTextAnchor = "start";
  let lx = station.x;
  let ly = station.y;

  if (manual) {
    anchor = manual.anchor ?? "start";
    lx = station.x + manual.dx;
    ly = station.y + manual.dy - (anchor === "end" && station.side === "tl" ? totalHeight - lineHeight : 0);
  } else {
    switch (station.side) {
      case "r":
        anchor = "start";
        lx = station.x + gap;
        ly = station.y - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.34;
        break;
      case "l":
        anchor = "end";
        lx = station.x - gap;
        ly = station.y - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.34;
        break;
      case "t":
        anchor = "middle";
        lx = station.x;
        ly = station.y - gap - (lines.length - 1) * lineHeight - 2;
        break;
      case "b":
        anchor = "middle";
        lx = station.x;
        ly = station.y + gap + fontSize * 0.82;
        break;
      case "tl":
        anchor = "end";
        lx = station.x - gap * 0.8;
        ly = station.y - gap * 0.65 - (lines.length - 1) * lineHeight;
        break;
      case "br":
        anchor = "start";
        lx = station.x + gap * 0.5;
        ly = station.y + gap + fontSize * 0.82;
        break;
    }
  }

  return {
    id: station.id,
    x: lx,
    y: ly,
    anchor,
    lines,
    fontSize,
    lineHeight,
    isMajor,
  };
}

const LABEL_CACHE: Record<string, StationLabelLayout[]> = {};

export function getAllStationLabels(language: string): StationLabelLayout[] {
  const cacheKey = language === "ar" || language === "ur" ? "ar" : "en";
  if (!LABEL_CACHE[cacheKey]) {
    LABEL_CACHE[cacheKey] = MAP_GEOMETRY.stations.map((s) =>
      computeStationLabel(s, cacheKey),
    );
  }
  return LABEL_CACHE[cacheKey];
}

export function findNearestStation(
  mapX: number,
  mapY: number,
  maxDistanceUnits: number,
): MapStation | null {
  let closest: MapStation | null = null;
  let bestDist = maxDistanceUnits;

  for (const station of MAP_GEOMETRY.stations) {
    const d = Math.hypot(station.x - mapX, station.y - mapY);
    if (d <= bestDist) {
      bestDist = d;
      closest = station;
    }
  }
  return closest;
}

export function computeBoundsForStationIds(ids: string[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let count = 0;

  for (const id of ids) {
    const st = STATION_BY_ID[id];
    if (!st) continue;
    count++;
    if (st.x < minX) minX = st.x;
    if (st.y < minY) minY = st.y;
    if (st.x > maxX) maxX = st.x;
    if (st.y > maxY) maxY = st.y;
  }

  if (count === 0) return null;
  return { minX, minY, maxX, maxY };
}
