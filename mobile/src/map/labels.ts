import {
  HUB_ICONS,
  LINE_BADGES,
  LineBadgePlacement,
  MAP_GEOMETRY,
  MapStation,
  STATION_BY_ID,
} from "./geometry";

export type SvgTextAnchor = "start" | "middle" | "end";

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface StationLabelLayout {
  id: string;
  x: number;
  y: number;
  anchor: SvgTextAnchor;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  isMajor: boolean;
  bbox: BoundingBox;
}

export const FAR_ZOOM_THRESHOLD = 0.72;

const NORMAL_MANUAL_OFFSETS: Record<
  string,
  { dx: number; dy: number; anchor?: SvgTextAnchor }
> = {
  ishbiliyah: { dx: 4, dy: 15, anchor: "start" },
  stc: { dx: -11, dy: -11, anchor: "end" },
  hokm: { dx: -11, dy: -11, anchor: "end" },
  rabi: { dx: -10, dy: -11, anchor: "end" },
  naseem: { dx: -13, dy: -4, anchor: "end" },
};

const FAR_MANUAL_OFFSETS: Record<
  string,
  { dx: number; dy: number; anchor: SvgTextAnchor; vSide: "t" | "b" }
> = {
  rabi: { dx: 4, dy: 22, anchor: "start", vSide: "b" },
  uthman: { dx: 18, dy: -18, anchor: "middle", vSide: "t" },
  sabic: { dx: 8, dy: 22, anchor: "start", vSide: "b" },
  hamra: { dx: 0, dy: -18, anchor: "middle", vSide: "t" },
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

function boxesOverlap(a: BoundingBox, b: BoundingBox, pad = 2): boolean {
  return !(
    a.x1 + pad < b.x0 ||
    b.x1 + pad < a.x0 ||
    a.y1 + pad < b.y0 ||
    b.y1 + pad < a.y0
  );
}

export function computeStationLabel(
  station: MapStation,
  language: string,
  renderScale = 1.0,
): StationLabelLayout {
  const isArabicScript = language === "ar" || language === "ur";
  const isFar = renderScale < FAR_ZOOM_THRESHOLD;

  const lines = isArabicScript
    ? isFar && station.ar.includes(" - ")
      ? [station.ar.split(" - ")[0].trim()]
      : wrapArabicLabel(station.ar)
    : station.labelEn && station.labelEn.length > 0
      ? station.labelEn
      : [station.en];

  const isMajor = station.interchange || station.terminus;
  const baseFontSize = isMajor ? 13.0 : 12.0;
  const fontSize =
    isFar && isMajor
      ? Math.min(34, Math.max(baseFontSize, 11.5 / Math.max(0.28, renderScale)))
      : baseFontSize;
  const lineHeight = fontSize * 1.13;
  const totalHeight = lines.length * lineHeight;

  const r = getStationRadius(station);
  const gap = r + (isFar ? 6.5 : 5.5);

  let anchor: SvgTextAnchor = "start";
  let lx = station.x;
  let ly = station.y;

  const farManual = isFar ? FAR_MANUAL_OFFSETS[station.id] : undefined;
  const normalManual = NORMAL_MANUAL_OFFSETS[station.id];

  if (farManual) {
    anchor = farManual.anchor;
    lx = station.x + farManual.dx;
    ly =
      farManual.vSide === "t"
        ? station.y + farManual.dy - (lines.length - 1) * lineHeight
        : station.y + farManual.dy + fontSize * 0.78;
  } else if (normalManual) {
    anchor = normalManual.anchor ?? "start";
    lx = station.x + normalManual.dx;
    ly =
      station.y +
      normalManual.dy -
      (anchor === "end" && station.side === "tl"
        ? totalHeight - lineHeight
        : 0);
  } else {
    switch (station.side) {
      case "r":
        anchor = "start";
        lx = station.x + gap;
        ly =
          station.y -
          ((lines.length - 1) * lineHeight) / 2 +
          fontSize * 0.34;
        break;
      case "l":
        anchor = "end";
        lx = station.x - gap;
        ly =
          station.y -
          ((lines.length - 1) * lineHeight) / 2 +
          fontSize * 0.34;
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

  const charFactor = isArabicScript ? 0.51 : 0.55;
  const maxChars = Math.max(...lines.map((l) => l.length), 1);
  const estWidth = maxChars * fontSize * charFactor;
  const topY = ly - fontSize * 0.84;
  const botY = topY + totalHeight;
  const leftX =
    anchor === "start"
      ? lx
      : anchor === "end"
        ? lx - estWidth
        : lx - estWidth / 2;

  return {
    id: station.id,
    x: lx,
    y: ly,
    anchor,
    lines,
    fontSize,
    lineHeight,
    isMajor,
    bbox: {
      x0: leftX,
      y0: topY,
      x1: leftX + estWidth,
      y1: botY,
    },
  };
}

export function getVisibleStationLabels(
  language: string,
  renderScale: number,
  activeStationIds: Set<string> | null,
): StationLabelLayout[] {
  const isFar = renderScale < FAR_ZOOM_THRESHOLD;
  const stations = isFar
    ? MAP_GEOMETRY.stations.filter(
        (s) => s.interchange || s.terminus || activeStationIds?.has(s.id),
      )
    : MAP_GEOMETRY.stations;

  return stations.map((s) => computeStationLabel(s, language, renderScale));
}

export function getNonCollidingLineBadges(
  language: string,
  renderScale: number,
  activeStationIds: Set<string> | null,
): { badge: LineBadgePlacement; radius: number; fontSize: number }[] {
  const isFar = renderScale < FAR_ZOOM_THRESHOLD;
  const radius = isFar
    ? Math.min(18, Math.max(10.5, 8.5 / Math.max(0.3, renderScale)))
    : 9.5;
  const fontSize = radius * 1.1;

  const visibleLabels = getVisibleStationLabels(
    language,
    renderScale,
    activeStationIds,
  );

  const obstacles: BoundingBox[] = [];

  for (const st of MAP_GEOMETRY.stations) {
    const sr = getStationRadius(st) + 2;
    obstacles.push({
      x0: st.x - sr,
      y0: st.y - sr,
      x1: st.x + sr,
      y1: st.y + sr,
    });
  }

  for (const hub of HUB_ICONS) {
    obstacles.push({
      x0: hub.x - 9,
      y0: hub.y - 9,
      x1: hub.x + 9,
      y1: hub.y + 9,
    });
  }

  for (const lbl of visibleLabels) {
    obstacles.push(lbl.bbox);
  }

  const accepted: { badge: LineBadgePlacement; radius: number; fontSize: number }[] = [];

  for (const candidate of LINE_BADGES) {
    const box: BoundingBox = {
      x0: candidate.x - radius,
      y0: candidate.y - radius,
      x1: candidate.x + radius,
      y1: candidate.y + radius,
    };

    const collides = obstacles.some((ob) => boxesOverlap(box, ob, 1.5));
    if (!collides) {
      accepted.push({ badge: candidate, radius, fontSize });
      obstacles.push(box);
    }
  }

  return accepted;
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
