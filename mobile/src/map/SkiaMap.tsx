// The map drawn with Skia on the phone's graphics chip. Everything static (water, districts,
// lines, stations, signs, line numbers, names) is recorded once into a vector "picture"; the route,
// the dimming veil and the selection go into a second small picture. Every frame the pictures are
// replayed with the current pan and zoom, so the map stays sharp at any zoom and moves smoothly.
import React, { memo, useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  Canvas,
  FontWeight,
  Group,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkPaint,
  type SkPicture,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import {
  HUB_ICONS,
  MAP_GEOMETRY,
  type MapStation,
  PRECOMPUTED_LINE_PATHS,
  type RouteRenderData,
  STATION_BY_ID,
  type ThemeMode,
  type ThemePalette,
  WADI_SVG_PATH,
} from "./geometry";
import {
  getNonCollidingLineBadges,
  getVisibleStationLabels,
  type StationLabelLayout,
} from "./labels";

// ---------- small drawing helpers ----------

function fillPaint(color: string, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Fill);
  p.setColor(Skia.Color(color));
  if (alpha < 1) p.setAlphaf(alpha);
  return p;
}

function strokePaint(color: string, width: number, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeCap(StrokeCap.Round);
  p.setStrokeJoin(StrokeJoin.Round);
  p.setColor(Skia.Color(color));
  if (alpha < 1) p.setAlphaf(alpha);
  return p;
}

const pathCache = new Map<string, ReturnType<typeof Skia.Path.MakeFromSVGString>>();
function svgPath(d: string) {
  let p = pathCache.get(d);
  if (p === undefined) {
    p = Skia.Path.MakeFromSVGString(d);
    pathCache.set(d, p);
  }
  return p;
}

type Anchor = "start" | "middle" | "end";

// One line of text whose baseline starts (start), is centred (middle) or ends (end) at x, y,
// like SVG text-anchor; physical left/right, never mirrored. Arabic is shaped by SkParagraph.
function drawText(
  canvas: SkCanvas,
  text: string,
  x: number,
  y: number,
  opts: {
    size: number;
    color: string;
    weight?: FontWeight;
    anchor?: Anchor;
    halo?: { color: string; width: number };
    letterSpacing?: number;
    alpha?: number;
  },
) {
  const style = {
    fontSize: opts.size,
    fontFamilies: ["sans-serif"],
    fontStyle: { weight: opts.weight ?? FontWeight.Normal },
    letterSpacing: opts.letterSpacing,
  };
  const build = (paint: SkPaint) => {
    const para = Skia.ParagraphBuilder.Make()
      .pushStyle({ ...style, color: Skia.Color(opts.color) }, paint)
      .addText(text)
      .pop()
      .build();
    para.layout(100000);
    const w = Math.ceil(para.getMaxIntrinsicWidth()) + 1;
    para.layout(w);
    return { para, w };
  };
  const alpha = opts.alpha ?? 1;
  const fill = build(fillPaint(opts.color, alpha));
  const baseline = fill.para.getLineMetrics()[0]?.baseline ?? opts.size * 0.8;
  const factor = opts.anchor === "middle" ? 0.5 : opts.anchor === "end" ? 1 : 0;
  const left = x - fill.w * factor;
  const top = y - baseline;
  if (opts.halo) {
    const halo = build(strokePaint(opts.halo.color, opts.halo.width, alpha));
    halo.para.paint(canvas, left, top);
  }
  fill.para.paint(canvas, left, top);
}

// ---------- the parts of the map ----------

function drawStation(canvas: SkCanvas, st: MapStation, palette: ThemePalette, theme: ThemeMode) {
  const { x, y, interchange, terminus, lines } = st;
  if (interchange) {
    const count = lines.length;
    const spacing = 8.2;
    const w = (count - 1) * spacing + 14.5;
    const h = 14.5;
    const rect = Skia.XYWHRect(x - w / 2, y - h / 2, w, h);
    const rr = Skia.RRectXY(rect, h / 2, h / 2);
    canvas.drawRRect(rr, fillPaint(theme === "light" ? "#FFFFFF" : "#222D38"));
    canvas.drawRRect(rr, strokePaint(theme === "light" ? "#18212A" : "#E6ECF0", 2.2));
    lines.forEach((lineId, i) => {
      const cx = x - ((count - 1) * spacing) / 2 + i * spacing;
      canvas.drawCircle(cx, y, 3.5, fillPaint(palette[lineId]));
    });
    return;
  }
  const lineColor = palette[lines[0] || "blue"];
  if (terminus) {
    canvas.drawCircle(x, y, 6.8, fillPaint(theme === "light" ? "#FFFFFF" : "#18212A"));
    canvas.drawCircle(x, y, 6.8, strokePaint(lineColor, 3.4));
    canvas.drawCircle(x, y, 2.6, fillPaint(lineColor));
    return;
  }
  canvas.drawCircle(x, y, 4.8, fillPaint(theme === "light" ? "#FFFFFF" : "#10161C"));
  canvas.drawCircle(x, y, 4.8, strokePaint(lineColor, 2.6));
}

// Pictograms on a 24-unit grid (Material Design icons "flight" and "train", Apache License 2.0).
const PLANE_D =
  "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";
const TRAIN_D =
  "M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z";
const HUB_RADIUS = 13;

function drawHub(canvas: SkCanvas, kind: "plane" | "train", x: number, y: number, palette: ThemePalette, theme: ThemeMode) {
  canvas.drawCircle(x, y, HUB_RADIUS + 1.8, fillPaint(palette.bg));
  canvas.drawCircle(x, y, HUB_RADIUS, fillPaint(theme === "light" ? "#18212A" : "#E6ECF0"));
  const p = svgPath(kind === "plane" ? PLANE_D : TRAIN_D);
  if (!p) return;
  const k = 0.78;
  canvas.save();
  canvas.translate(x - 12 * k, y - 12 * k);
  canvas.scale(k, k);
  canvas.drawPath(p, fillPaint(theme === "light" ? "#FFFFFF" : "#18212A"));
  canvas.restore();
}

function drawLabel(canvas: SkCanvas, lbl: StationLabelLayout, palette: ThemePalette) {
  const weight = lbl.isMajor ? FontWeight.Bold : FontWeight.Medium;
  const haloWidth = Math.max(3.6, lbl.fontSize * 0.28);
  lbl.lines.forEach((line, i) => {
    drawText(canvas, line, lbl.x, lbl.y + i * lbl.lineHeight, {
      size: lbl.fontSize,
      color: palette.fg,
      weight,
      anchor: lbl.anchor as Anchor,
      halo: { color: palette.bg, width: haloWidth },
    });
  });
}

// Label and badge layout is computed once per language and kept.
const labelCache = new Map<string, StationLabelLayout[]>();
function labelsFor(language: string): StationLabelLayout[] {
  let v = labelCache.get(language);
  if (!v) {
    v = getVisibleStationLabels(language, 1, null);
    labelCache.set(language, v);
  }
  return v;
}

function recordBase(
  palette: ThemePalette,
  theme: ThemeMode,
  language: string,
  origin: { x0: number; y0: number; w: number; h: number },
): SkPicture {
  const rec = Skia.PictureRecorder();
  const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, origin.w, origin.h));
  canvas.translate(-origin.x0, -origin.y0);
  const isAr = language === "ar" || language === "ur";

  // background (larger than the network, so panning to an edge never shows a gap)
  canvas.drawRect(
    Skia.XYWHRect(origin.x0 - 4000, origin.y0 - 4000, origin.w + 8000, origin.h + 8000),
    fillPaint(palette.bg),
  );

  // wadi band and its name
  const wadi = svgPath(WADI_SVG_PATH);
  if (wadi) canvas.drawPath(wadi, strokePaint(palette.water, 28, 0.75));
  const wl = MAP_GEOMETRY.wadi.label;
  canvas.save();
  canvas.rotate(-78, wl.x, wl.y);
  drawText(canvas, isAr ? wl.ar : wl.en, wl.x, wl.y, {
    size: 11,
    color: palette.muted,
    anchor: "middle",
    alpha: 0.65,
  });
  canvas.restore();

  // district names, faint
  for (const d of MAP_GEOMETRY.districts) {
    drawText(canvas, isAr ? d.ar : d.en, d.x, d.y, {
      size: 13,
      color: palette.muted,
      weight: FontWeight.Bold,
      anchor: "middle",
      letterSpacing: 1.4,
      alpha: 0.28,
    });
  }

  // lines
  for (const seg of PRECOMPUTED_LINE_PATHS) {
    const p = svgPath(seg.d);
    if (p) canvas.drawPath(p, strokePaint(palette[seg.lineId], 12));
  }

  // stations and hub signs
  for (const st of MAP_GEOMETRY.stations) drawStation(canvas, st, palette, theme);
  for (const hub of HUB_ICONS) drawHub(canvas, hub.kind, hub.x, hub.y, palette, theme);

  // line number badges
  for (const { badge, radius, fontSize } of getNonCollidingLineBadges(language, 1, null)) {
    canvas.drawCircle(badge.x, badge.y, radius, fillPaint(palette[badge.lineId]));
    canvas.drawCircle(badge.x, badge.y, radius, strokePaint(palette.bg, 2));
    drawText(canvas, String(badge.number), badge.x, badge.y + fontSize * 0.35, {
      size: fontSize,
      color: badge.lineId === "yellow" ? "#18212A" : "#FFFFFF",
      weight: FontWeight.Bold,
      anchor: "middle",
    });
  }

  // station names
  for (const lbl of labelsFor(language)) drawLabel(canvas, lbl, palette);

  return rec.finishRecordingAsPicture();
}

function recordOverlay(
  palette: ThemePalette,
  theme: ThemeMode,
  language: string,
  routeData: RouteRenderData | null,
  selected: string | null | undefined,
  origin: { x0: number; y0: number; w: number; h: number },
): SkPicture | null {
  if (!routeData && !selected) return null;
  const rec = Skia.PictureRecorder();
  const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, origin.w, origin.h));
  canvas.translate(-origin.x0, -origin.y0);

  if (routeData) {
    // dim the whole map with one veil, then draw the route at full strength on top
    canvas.drawRect(
      Skia.XYWHRect(origin.x0 - 4000, origin.y0 - 4000, origin.w + 8000, origin.h + 8000),
      fillPaint(palette.bg, 0.74),
    );
    for (const seg of routeData.ridePaths) {
      const p = svgPath(seg.d);
      if (!p) continue;
      canvas.drawPath(p, strokePaint(palette.bg, 20));
      canvas.drawPath(p, strokePaint(palette[seg.lineId], 15.5));
    }
    const dash = strokePaint(palette.fg, 5);
    dash.setPathEffect(Skia.PathEffect.MakeDash([6, 6], 0));
    for (const w of routeData.walkSegments) {
      canvas.drawLine(w.x1, w.y1, w.x2, w.y2, dash);
    }
    routeData.stationIds.forEach((sid) => {
      const st = STATION_BY_ID[sid];
      if (st) drawStation(canvas, st, palette, theme);
    });
    for (const lbl of labelsFor(language)) {
      if (routeData.stationIds.has(lbl.id)) drawLabel(canvas, lbl, palette);
    }
    const pin = (st: MapStation, color: string, letter: string) => {
      canvas.drawCircle(st.x, st.y, 12.5, fillPaint(color));
      canvas.drawCircle(st.x, st.y, 12.5, strokePaint("#FFFFFF", 2.5));
      drawText(canvas, letter, st.x, st.y + 4, {
        size: 11,
        color: "#FFFFFF",
        weight: FontWeight.Bold,
        anchor: "middle",
      });
    };
    if (routeData.startStation) pin(routeData.startStation, "#18212A", "A");
    if (routeData.endStation && routeData.endStation.id !== routeData.startStation?.id) {
      pin(routeData.endStation, "#E1251B", "B");
    }
  }

  const st = selected ? STATION_BY_ID[selected] : undefined;
  if (st) {
    canvas.drawCircle(st.x, st.y, 16, fillPaint(palette[st.lines[0] || "blue"], 0.22));
    canvas.drawCircle(st.x, st.y, 13, strokePaint(palette.fg, 2.5));
  }
  return rec.finishRecordingAsPicture();
}

// ---------- the component ----------

export interface SkiaMapProps {
  palette: ThemePalette;
  theme: ThemeMode;
  language: string;
  routeData: RouteRenderData | null;
  selected?: string | null;
  // canvas-local origin: map point (x0, y0) is local (0, 0); screen = translate + local * scale
  origin: { x0: number; y0: number; w: number; h: number };
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
}

const SkiaMap = memo(function SkiaMap({
  palette,
  theme,
  language,
  routeData,
  selected,
  origin,
  translateX,
  translateY,
  scale,
}: SkiaMapProps) {
  const base = useMemo(
    () => recordBase(palette, theme, language, origin),
    // origin is a module constant in the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette, theme, language],
  );
  const overlay = useMemo(
    () => recordOverlay(palette, theme, language, routeData, selected, origin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette, theme, language, routeData, selected],
  );
  const transform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Group transform={transform}>
        <Picture picture={base} />
        {overlay ? <Picture picture={overlay} /> : null}
      </Group>
    </Canvas>
  );
});

export default SkiaMap;
