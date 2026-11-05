import {
  ALL_LINE_SEGMENTS,
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

export const FULL_MAP_BOUNDS = {
  x0: -155,
  y0: 20,
  x1: 1140,
  y1: 1205,
};

type CandidateSide =
  | "r"
  | "l"
  | "t"
  | "b"
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "tl_high"
  | "tr_high"
  | "bl_low"
  | "br_low";

const ALL_CANDIDATE_SIDES: CandidateSide[] = [
  "r",
  "l",
  "t",
  "b",
  "tl",
  "tr",
  "bl",
  "br",
  "tl_high",
  "tr_high",
  "bl_low",
  "br_low",
];

const PREFERRED_SIDE_OVERRIDES: Record<string, CandidateSide> = {
  hamra: "tr_high",
  uthman: "b",
  rabi: "b",
  sabic: "b",
  stc: "tl",
  hokm: "tl",
  naseem: "tl",
  moe: "br",
  ishbiliyah: "b",
  kbw: "tl",
  rec: "br_low",
  nuzhah: "tl",
  hassan: "br",
  kaaroad: "b",
  habib: "tr_high",
  andalus: "tr_high",
  khurais: "tr_high",
  salam: "tr_high",
};

export function wrapStationLines(
  rawLines: string[],
  maxChars = 14,
): string[] {
  if (rawLines.length >= 2) {
    return rawLines;
  }
  const text = (rawLines[0] ?? "").trim();
  if (!text) return [""];
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

function boxesOverlap(a: BoundingBox, b: BoundingBox, pad = 1.5): boolean {
  return !(
    a.x1 + pad < b.x0 ||
    b.x1 + pad < a.x0 ||
    a.y1 + pad < b.y0 ||
    b.y1 + pad < a.y0
  );
}

function segmentIntersectsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  box: BoundingBox,
  clearance = 6.8,
): boolean {
  if (
    Math.max(x1, x2) + clearance < box.x0 ||
    Math.min(x1, x2) - clearance > box.x1 ||
    Math.max(y1, y2) + clearance < box.y0 ||
    Math.min(y1, y2) - clearance > box.y1
  ) {
    return false;
  }
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    const px = x1 + t * (x2 - x1);
    const py = y1 + t * (y2 - y1);
    const dx = Math.max(box.x0 - px, 0, px - box.x1);
    const dy = Math.max(box.y0 - py, 0, py - box.y1);
    if (Math.hypot(dx, dy) < clearance) {
      return true;
    }
  }
  return false;
}

function buildCandidateLayout(
  station: MapStation,
  side: CandidateSide,
  lines: string[],
  fontSize: number,
  lineHeight: number,
  extraGap: number,
  isArabicScript: boolean,
): StationLabelLayout {
  const charFactor = isArabicScript ? 0.49 : 0.52;
  const maxChars = Math.max(...lines.map((l) => l.length), 1);
  const estWidth = maxChars * fontSize * charFactor;
  const totalHeight = lines.length * lineHeight;

  const r = getStationRadius(station);
  const gap = r + 7.2 + extraGap;
  const { x, y } = station;

  let anchor: SvgTextAnchor = "start";
  let lx = x;
  let ly = y;

  switch (side) {
    case "r":
      anchor = "start";
      lx = x + gap;
      ly = y - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.32;
      break;
    case "l":
      anchor = "end";
      lx = x - gap;
      ly = y - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.32;
      break;
    case "t":
      anchor = "middle";
      lx = x;
      ly = y - gap - (lines.length - 1) * lineHeight - 2;
      break;
    case "b":
      anchor = "middle";
      lx = x;
      ly = y + gap + fontSize * 0.82;
      break;
    case "tl":
      anchor = "end";
      lx = x - gap * 0.88;
      ly = y - gap * 0.48 - (lines.length - 1) * lineHeight;
      break;
    case "tl_high":
      anchor = "end";
      lx = x - gap * 0.52;
      ly = y - gap * 0.92 - (lines.length - 1) * lineHeight;
      break;
    case "tr":
      anchor = "start";
      lx = x + gap * 0.88;
      ly = y - gap * 0.48 - (lines.length - 1) * lineHeight;
      break;
    case "tr_high":
      anchor = "start";
      lx = x + gap * 0.52;
      ly = y - gap * 0.92 - (lines.length - 1) * lineHeight;
      break;
    case "bl":
      anchor = "end";
      lx = x - gap * 0.88;
      ly = y + gap * 0.48 + fontSize * 0.82;
      break;
    case "bl_low":
      anchor = "end";
      lx = x - gap * 0.52;
      ly = y + gap * 0.92 + fontSize * 0.82;
      break;
    case "br":
      anchor = "start";
      lx = x + gap * 0.88;
      ly = y + gap * 0.48 + fontSize * 0.82;
      break;
    case "br_low":
      anchor = "start";
      lx = x + gap * 0.52;
      ly = y + gap * 0.92 + fontSize * 0.82;
      break;
  }

  const topY = ly - fontSize * 0.82;
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
    isMajor: station.interchange || station.terminus,
    bbox: {
      x0: leftX,
      y0: topY,
      x1: leftX + estWidth,
      y1: botY,
    },
  };
}

function getStationPriority(station: MapStation, activeIds: Set<string> | null): number {
  if (activeIds?.has(station.id)) return 5;
  if (station.id === "rabi" || station.id === "uthman") return 2;
  if (station.interchange) return 4;
  if (station.terminus) return 3;
  return 1;
}

export function getVisibleStationLabels(
  language: string,
  renderScale: number,
  activeStationIds: Set<string> | null,
): StationLabelLayout[] {
  const isArabicScript = language === "ar" || language === "ur";
  const isFar = renderScale < FAR_ZOOM_THRESHOLD;

  const candidateStations = isFar
    ? MAP_GEOMETRY.stations.filter(
        (s) => s.interchange || s.terminus || activeStationIds?.has(s.id),
      )
    : [...MAP_GEOMETRY.stations];

  candidateStations.sort(
    (a, b) =>
      getStationPriority(b, activeStationIds) -
      getStationPriority(a, activeStationIds),
  );

  const obstacles: BoundingBox[] = [];

  for (const st of MAP_GEOMETRY.stations) {
    const sr = getStationRadius(st) + 1.5;
    obstacles.push({
      x0: st.x - sr,
      y0: st.y - sr,
      x1: st.x + sr,
      y1: st.y + sr,
    });
  }

  for (const hub of HUB_ICONS) {
    obstacles.push({
      x0: hub.x - 15,
      y0: hub.y - 15,
      x1: hub.x + 15,
      y1: hub.y + 15,
    });
  }

  const placed: StationLabelLayout[] = [];
  const extraGaps = [0, 4, 8, 12];

  for (const station of candidateStations) {
    const raw = isArabicScript
      ? [station.ar]
      : station.labelEn && station.labelEn.length > 0
        ? station.labelEn
        : [station.en];
    const lines = wrapStationLines(raw, 14);
    const isMajor = station.interchange || station.terminus;
    const baseFontSize = isMajor ? 12.0 : 11.2;
    const fontSize =
      isFar && isMajor
        ? Math.min(
            28.5,
            Math.max(baseFontSize, 11.0 / Math.max(0.28, renderScale)),
          )
        : baseFontSize;
    const lineHeight = fontSize * 1.12;

    const preferred: CandidateSide =
      PREFERRED_SIDE_OVERRIDES[station.id] ?? station.side;
    const orderedSides: CandidateSide[] = [
      preferred,
      ...ALL_CANDIDATE_SIDES.filter((s) => s !== preferred),
    ];

    let chosen: StationLabelLayout | null = null;

    for (const extra of extraGaps) {
      if (chosen) break;
      for (const side of orderedSides) {
        const cand = buildCandidateLayout(
          station,
          side,
          lines,
          fontSize,
          lineHeight,
          extra,
          isArabicScript,
        );

        const hitsLine = ALL_LINE_SEGMENTS.some((seg) =>
          segmentIntersectsBox(seg.x1, seg.y1, seg.x2, seg.y2, cand.bbox, 6.8),
        );
        if (hitsLine) continue;

        const hitsObstacle = obstacles.some((ob) =>
          boxesOverlap(cand.bbox, ob, 1.5),
        );
        if (hitsObstacle) continue;

        chosen = cand;
        break;
      }
    }

    if (chosen) {
      placed.push(chosen);
      obstacles.push(chosen.bbox);
    }
  }

  return placed;
}

export function getNonCollidingLineBadges(
  language: string,
  renderScale: number,
  activeStationIds: Set<string> | null,
  visibleLabels?: StationLabelLayout[],
): { badge: LineBadgePlacement; radius: number; fontSize: number }[] {
  const isFar = renderScale < FAR_ZOOM_THRESHOLD;
  const radius = isFar
    ? Math.min(17, Math.max(10.5, 8.2 / Math.max(0.28, renderScale)))
    : 9.5;
  const fontSize = radius * 1.1;

  const labels =
    visibleLabels ??
    getVisibleStationLabels(language, renderScale, activeStationIds);

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
      x0: hub.x - 16,
      y0: hub.y - 16,
      x1: hub.x + 16,
      y1: hub.y + 16,
    });
  }

  for (const lbl of labels) {
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
