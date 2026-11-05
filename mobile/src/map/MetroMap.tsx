import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Rect } from "react-native-svg";
import type { Route } from "../core/metro";
import {
  buildRouteRenderData,
  MAP_GEOMETRY,
  RouteHighlightInput,
  ThemeMode,
  ThemePalette,
} from "./geometry";
import {
  computeBoundsForStationIds,
  FAR_ZOOM_THRESHOLD,
  findNearestStation,
  FULL_MAP_BOUNDS,
} from "./labels";
import {
  BadgesLayer,
  DistrictsLayer,
  LabelsLayer,
  LinesLayer,
  RouteOverlayLayer,
  SelectionLayer,
  StationsLayer,
  WadiLayer,
} from "./MapLayers";

export interface MetroMapProps {
  theme: ThemeMode;
  language: string;
  selected?: string | null;
  route?: RouteHighlightInput | Route | null;
  onStationPress?: (stationId: string) => void;
  onLongPress?: (stationId: string) => void;
  topInset?: number;
  bottomInset?: number;
  fontRegular?: string;
  fontBold?: string;
}

export interface MetroMapRef {
  fitNetwork: () => void;
  focus: (stationIds: string[]) => void;
}

const NET_W = FULL_MAP_BOUNDS.x1 - FULL_MAP_BOUNDS.x0;
const NET_H = FULL_MAP_BOUNDS.y1 - FULL_MAP_BOUNDS.y0;

const SVG_PAD = 60;
const SVG_X0 = FULL_MAP_BOUNDS.x0 - SVG_PAD;
const SVG_Y0 = FULL_MAP_BOUNDS.y0 - SVG_PAD;
const CANVAS_W = NET_W + SVG_PAD * 2;
const CANVAS_H = NET_H + SVG_PAD * 2;

const DEFAULT_CENTER_X = 535;
const DEFAULT_CENTER_Y = 645;
const DEFAULT_SCALE = 1.0;
const MAX_SCALE = 3.0;
const FIT_MARGIN_PT = 16;

function computeFitScale(
  viewW: number,
  viewH: number,
  topInset: number,
  bottomInset: number,
): number {
  "worklet";
  if (viewW <= 0 || viewH <= 0) return 0.28;
  const usableH = Math.max(200, viewH - topInset - bottomInset);
  return Math.min(
    1.0,
    Math.max(
      0.2,
      Math.min(
        (viewW - FIT_MARGIN_PT * 2) / NET_W,
        (usableH - FIT_MARGIN_PT * 2) / NET_H,
      ),
    ),
  );
}

function clampTranslation(
  tx: number,
  ty: number,
  scale: number,
  viewW: number,
  viewH: number,
  topInset: number,
  bottomInset: number,
): { x: number; y: number } {
  "worklet";
  if (viewW <= 0 || viewH <= 0) return { x: tx, y: ty };

  // Per axis the network must stay on screen: when it is larger than the free area it may not
  // leave a gap at either edge, when it is smaller it may not leave the area. Both cases are one
  // continuous range, so zooming never snaps the map to the centre (that was the "jump").
  const usableH = Math.max(200, viewH - topInset - bottomInset);
  const ax = FIT_MARGIN_PT - SVG_PAD * scale;
  const bx = viewW - FIT_MARGIN_PT - (SVG_PAD + NET_W) * scale;
  const ay = topInset + FIT_MARGIN_PT - SVG_PAD * scale;
  const by = topInset + usableH - FIT_MARGIN_PT - (SVG_PAD + NET_H) * scale;
  const clampedX = Math.min(Math.max(ax, bx), Math.max(Math.min(ax, bx), tx));
  const clampedY = Math.min(Math.max(ay, by), Math.max(Math.min(ay, by), ty));

  return { x: clampedX, y: clampedY };
}

// Zoom tiers for the label layout: near zoom has one fixed layout (two for district opacity),
// far zoom a few steps, so finishing a pinch rarely redraws the base map.
function layoutScaleFor(renderScale: number): number {
  if (renderScale >= FAR_ZOOM_THRESHOLD) return renderScale >= 1.25 ? 1.25 : 1;
  return Math.max(0.2, Math.round(renderScale * 10) / 10);
}

const BaseMap = memo(function BaseMap({
  palette,
  theme,
  language,
  layoutScale,
  fontRegular,
  fontBold,
}: {
  palette: ThemePalette;
  theme: ThemeMode;
  language: string;
  layoutScale: number;
  fontRegular?: string;
  fontBold?: string;
}) {
  return (
    <Svg
      width={CANVAS_W}
      height={CANVAS_H}
      viewBox={`${SVG_X0} ${SVG_Y0} ${CANVAS_W} ${CANVAS_H}`}
    >
      <Rect x={SVG_X0} y={SVG_Y0} width={CANVAS_W} height={CANVAS_H} fill={palette.bg} />
      <WadiLayer
        palette={palette}
        theme={theme}
        language={language}
        fontRegular={fontRegular}
        fontBold={fontBold}
      />
      <DistrictsLayer
        palette={palette}
        theme={theme}
        language={language}
        renderScale={layoutScale}
        fontRegular={fontRegular}
        fontBold={fontBold}
      />
      <LinesLayer palette={palette} dimmed={false} />
      <StationsLayer palette={palette} theme={theme} dimmed={false} />
      <BadgesLayer
        palette={palette}
        language={language}
        renderScale={layoutScale}
        activeStationIds={null}
        dimmed={false}
        fontBold={fontBold}
      />
      <LabelsLayer
        palette={palette}
        language={language}
        renderScale={layoutScale}
        activeStationIds={null}
        fontRegular={fontRegular}
        fontBold={fontBold}
      />
    </Svg>
  );
});

const MetroMap = forwardRef<MetroMapRef, MetroMapProps>(function MetroMap(
  {
    theme,
    language,
    selected,
    route,
    onStationPress,
    onLongPress,
    topInset = 0,
    bottomInset = 88,
    fontRegular,
    fontBold,
  },
  ref,
) {
  const palette = MAP_GEOMETRY.colors[theme];
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [renderScale, setRenderScale] = useState<number>(DEFAULT_SCALE);
  const [initialized, setInitialized] = useState(false);
  const layoutScale = layoutScaleFor(renderScale);

  const scale = useSharedValue(DEFAULT_SCALE);
  const minScaleShared = useSharedValue(0.28);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(DEFAULT_SCALE);
  // time of the last pan or pinch movement: a tap or long press right after (or during) a
  // zoom or drag is a stray finger, not a station choice
  const lastMoveMs = useSharedValue(0);
  const pinchFocalMapX = useSharedValue(0);
  const pinchLastFocalX = useSharedValue(0);
  const pinchLastFocalY = useSharedValue(0);
  const pinchFocalMapY = useSharedValue(0);

  const commitRenderScale = useCallback((nextScale: number) => {
    const quantized = Math.round(nextScale * 25) / 25;
    setRenderScale((prev) =>
      Math.abs(prev - quantized) < 0.025 ? prev : quantized,
    );
  }, []);

  useEffect(() => {
    if (viewport.width > 0 && viewport.height > 0) {
      const fScale = computeFitScale(
        viewport.width,
        viewport.height,
        topInset,
        bottomInset,
      );
      minScaleShared.value = fScale;
      if (scale.value < fScale) {
        const clamped = clampTranslation(
          translateX.value,
          translateY.value,
          fScale,
          viewport.width,
          viewport.height,
          topInset,
          bottomInset,
        );
        scale.value = withTiming(fScale, { duration: 200 });
        translateX.value = withTiming(clamped.x, { duration: 200 });
        translateY.value = withTiming(clamped.y, { duration: 200 });
        commitRenderScale(fScale);
      }
    }
  }, [
    bottomInset,
    commitRenderScale,
    minScaleShared,
    scale,
    topInset,
    translateX,
    translateY,
    viewport.height,
    viewport.width,
  ]);

  const animateCameraTo = useCallback(
    (targetScale: number, targetTx: number, targetTy: number) => {
      const minS = computeFitScale(
        viewport.width,
        viewport.height,
        topInset,
        bottomInset,
      );
      minScaleShared.value = minS;
      const clampedScale = Math.min(MAX_SCALE, Math.max(minS, targetScale));
      const clamped = clampTranslation(
        targetTx,
        targetTy,
        clampedScale,
        viewport.width,
        viewport.height,
        topInset,
        bottomInset,
      );
      translateX.value = withTiming(clamped.x, { duration: 300 });
      translateY.value = withTiming(clamped.y, { duration: 300 });
      scale.value = withTiming(clampedScale, { duration: 300 }, (done) => {
        if (done) runOnJS(commitRenderScale)(clampedScale);
      });
    },
    [
      bottomInset,
      commitRenderScale,
      lastMoveMs,
      minScaleShared,
      scale,
      topInset,
      translateX,
      translateY,
      viewport.height,
      viewport.width,
    ],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;
      setViewport({ width, height });

      const fScale = computeFitScale(width, height, topInset, bottomInset);
      minScaleShared.value = fScale;

      if (!initialized) {
        const usableH = Math.max(200, height - topInset - bottomInset);
        const initScale = DEFAULT_SCALE;
        const localCenterX = DEFAULT_CENTER_X - SVG_X0;
        const localCenterY = DEFAULT_CENTER_Y - SVG_Y0;
        const tx = width / 2 - localCenterX * initScale;
        const ty = topInset + usableH / 2 - localCenterY * initScale;
        const clamped = clampTranslation(
          tx,
          ty,
          initScale,
          width,
          height,
          topInset,
          bottomInset,
        );
        scale.value = initScale;
        translateX.value = clamped.x;
        translateY.value = clamped.y;
        setRenderScale(initScale);
        setInitialized(true);
      }
    },
    [
      bottomInset,
      initialized,
      minScaleShared,
      scale,
      topInset,
      translateX,
      translateY,
    ],
  );

  const fitNetwork = useCallback(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const fitScale = computeFitScale(
      viewport.width,
      viewport.height,
      topInset,
      bottomInset,
    );
    const usableH = Math.max(200, viewport.height - topInset - bottomInset);
    const tx = viewport.width / 2 - (SVG_PAD + NET_W / 2) * fitScale;
    const ty = topInset + usableH / 2 - (SVG_PAD + NET_H / 2) * fitScale;
    animateCameraTo(fitScale, tx, ty);
  }, [animateCameraTo, bottomInset, topInset, viewport.height, viewport.width]);

  const focus = useCallback(
    (stationIds: string[]) => {
      if (viewport.width <= 0 || viewport.height <= 0) return;
      const bounds = computeBoundsForStationIds(stationIds);
      if (!bounds) return;
      const minS = computeFitScale(
        viewport.width,
        viewport.height,
        topInset,
        bottomInset,
      );
      const usableH = Math.max(200, viewport.height - topInset - bottomInset);
      const spanX = Math.max(160, bounds.maxX - bounds.minX + 160);
      const spanY = Math.max(160, bounds.maxY - bounds.minY + 160);
      const targetScale = Math.min(
        1.45,
        Math.max(
          minS,
          Math.min((viewport.width - 48) / spanX, (usableH - 64) / spanY),
        ),
      );
      const centerMapX = (bounds.minX + bounds.maxX) / 2 - SVG_X0;
      const centerMapY = (bounds.minY + bounds.maxY) / 2 - SVG_Y0;
      const tx = viewport.width / 2 - centerMapX * targetScale;
      const ty = topInset + usableH / 2 - centerMapY * targetScale;
      animateCameraTo(targetScale, tx, ty);
    },
    [animateCameraTo, bottomInset, topInset, viewport.height, viewport.width],
  );

  useImperativeHandle(
    ref,
    () => ({
      fitNetwork,
      focus,
    }),
    [fitNetwork, focus],
  );

  const routeData = useMemo(() => buildRouteRenderData(route), [route]);

  // focus the camera once per new route, not again when the sheet height, the viewport or the
  // minute clock re-creates the same route object
  const focusedRouteKey = useRef("");
  useEffect(() => {
    if (!routeData || routeData.stationIds.size === 0) {
      focusedRouteKey.current = "";
      return;
    }
    if (!initialized) return;
    const ids = Array.from(routeData.stationIds);
    const key = ids.join(",");
    if (key === focusedRouteKey.current) return;
    focusedRouteKey.current = key;
    focus(ids);
  }, [focus, initialized, routeData]);

  const handleTapOnJS = useCallback(
    (
      screenX: number,
      screenY: number,
      currentTx: number,
      currentTy: number,
      currentScale: number,
    ) => {
      if (!onStationPress) return;
      const mapX = (screenX - currentTx) / currentScale + SVG_X0;
      const mapY = (screenY - currentTy) / currentScale + SVG_Y0;
      const hitRadiusUnits = Math.max(14, 24 / currentScale);
      const hit = findNearestStation(mapX, mapY, hitRadiusUnits);
      if (hit) {
        onStationPress(hit.id);
      }
    },
    [onStationPress],
  );

  const handleLongPressOnJS = useCallback(
    (
      screenX: number,
      screenY: number,
      currentTx: number,
      currentTy: number,
      currentScale: number,
    ) => {
      if (!onLongPress) return;
      const mapX = (screenX - currentTx) / currentScale + SVG_X0;
      const mapY = (screenY - currentTy) / currentScale + SVG_Y0;
      const hitRadiusUnits = Math.max(16, 26 / currentScale);
      const hit = findNearestStation(mapX, mapY, hitRadiusUnits);
      if (hit) {
        onLongPress(hit.id);
      }
    },
    [onLongPress],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .maxPointers(1)
        .onStart(() => {
          panStartX.value = translateX.value;
          panStartY.value = translateY.value;
        })
        .onUpdate((e) => {
          const next = clampTranslation(
            panStartX.value + e.translationX,
            panStartY.value + e.translationY,
            scale.value,
            viewport.width,
            viewport.height,
            topInset,
            bottomInset,
          );
          translateX.value = next.x;
          translateY.value = next.y;
          lastMoveMs.value = Date.now();
        })
        .onEnd(() => {
          lastMoveMs.value = Date.now();
        }),
    [
      bottomInset,
      lastMoveMs,
      panStartX,
      panStartY,
      scale,
      topInset,
      translateX,
      translateY,
      viewport.height,
      viewport.width,
    ],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart((e) => {
          lastMoveMs.value = Date.now();
          pinchStartScale.value = scale.value;
          pinchFocalMapX.value = (e.focalX - translateX.value) / scale.value;
          pinchFocalMapY.value = (e.focalY - translateY.value) / scale.value;
        })
        .onUpdate((e) => {
          // past the zoom limits the map gives way softly instead of stopping dead, then
          // eases back when the fingers lift
          const raw = pinchStartScale.value * e.scale;
          const lo = minScaleShared.value;
          const nextScale =
            raw < lo
              ? lo * Math.pow(raw / lo, 0.35)
              : raw > MAX_SCALE
                ? MAX_SCALE * Math.pow(raw / MAX_SCALE, 0.35)
                : raw;
          pinchLastFocalX.value = e.focalX;
          pinchLastFocalY.value = e.focalY;
          const rawTx = e.focalX - pinchFocalMapX.value * nextScale;
          const rawTy = e.focalY - pinchFocalMapY.value * nextScale;
          const clamped = clampTranslation(
            rawTx,
            rawTy,
            nextScale,
            viewport.width,
            viewport.height,
            topInset,
            bottomInset,
          );
          scale.value = nextScale;
          translateX.value = clamped.x;
          translateY.value = clamped.y;
          lastMoveMs.value = Date.now();
        })
        .onEnd(() => {
          lastMoveMs.value = Date.now();
          const target = Math.min(
            MAX_SCALE,
            Math.max(minScaleShared.value, scale.value),
          );
          if (target !== scale.value) {
            const fx = pinchLastFocalX.value;
            const fy = pinchLastFocalY.value;
            const mx = (fx - translateX.value) / scale.value;
            const my = (fy - translateY.value) / scale.value;
            const back = clampTranslation(
              fx - mx * target,
              fy - my * target,
              target,
              viewport.width,
              viewport.height,
              topInset,
              bottomInset,
            );
            translateX.value = withTiming(back.x, { duration: 220 });
            translateY.value = withTiming(back.y, { duration: 220 });
            // redraw the labels only after the motion, so it never stutters
            scale.value = withTiming(target, { duration: 220 }, (done) => {
              if (done) runOnJS(commitRenderScale)(target);
            });
          } else {
            runOnJS(commitRenderScale)(target);
          }
        }),
    [
      bottomInset,
      commitRenderScale,
      minScaleShared,
      pinchFocalMapX,
      pinchFocalMapY,
      pinchStartScale,
      scale,
      topInset,
      translateX,
      translateY,
      viewport.height,
      viewport.width,
    ],
  );

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(250)
        .maxDistance(10)
        .onTouchesDown((e, manager) => {
          if (e.numberOfTouches > 1) manager.fail();
        })
        .onEnd((e, success) => {
          if (!success || Date.now() - lastMoveMs.value < 300) return;
          const currentScale = scale.value;
          const nextScale =
            currentScale >= 2.0
              ? DEFAULT_SCALE
              : Math.min(MAX_SCALE, currentScale * 1.65);
          const fx = (e.x - translateX.value) / currentScale;
          const fy = (e.y - translateY.value) / currentScale;
          const rawTx = e.x - fx * nextScale;
          const rawTy = e.y - fy * nextScale;
          const clamped = clampTranslation(
            rawTx,
            rawTy,
            nextScale,
            viewport.width,
            viewport.height,
            topInset,
            bottomInset,
          );
          translateX.value = withTiming(clamped.x, { duration: 240 });
          translateY.value = withTiming(clamped.y, { duration: 240 });
          scale.value = withTiming(nextScale, { duration: 240 }, (done) => {
            if (done) runOnJS(commitRenderScale)(nextScale);
          });
        }),
    [
      bottomInset,
      commitRenderScale,
      lastMoveMs,
      scale,
      topInset,
      translateX,
      translateY,
      viewport.height,
      viewport.width,
    ],
  );

  const singleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(1)
        .maxDuration(250)
        .maxDistance(10)
        .onTouchesDown((e, manager) => {
          if (e.numberOfTouches > 1) manager.fail();
        })
        .onEnd((e, success) => {
          if (!success || Date.now() - lastMoveMs.value < 300) return;
          runOnJS(handleTapOnJS)(
            e.x,
            e.y,
            translateX.value,
            translateY.value,
            scale.value,
          );
        }),
    [handleTapOnJS, scale, translateX, translateY, lastMoveMs],
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(450)
        .maxDistance(10)
        .onTouchesDown((e, manager) => {
          if (e.numberOfTouches > 1) manager.fail();
        })
        .onStart((e) => {
          if (Date.now() - lastMoveMs.value < 300) return;
          runOnJS(handleLongPressOnJS)(
            e.x,
            e.y,
            translateX.value,
            translateY.value,
            scale.value,
          );
        }),
    [handleLongPressOnJS, scale, translateX, translateY, lastMoveMs],
  );

  const composedGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        panGesture,
        pinchGesture,
        Gesture.Exclusive(doubleTapGesture, singleTapGesture, longPressGesture),
      ),
    [doubleTapGesture, longPressGesture, panGesture, pinchGesture, singleTapGesture],
  );

  // scale around the canvas top-left corner (transformOrigin below), so a map point p is drawn at
  // translate + p * scale exactly, the same formula the pinch and clamp maths use. Relying on the
  // default centre origin let the map drift sideways while zooming on Android.
  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: palette.bg }]}
      onLayout={onLayout}
    >
      <GestureDetector gesture={composedGesture}>
        <View style={styles.gestureSurface} collapsable={false}>
          <Animated.View
            style={[
              styles.canvasWrapper,
              { width: CANVAS_W, height: CANVAS_H },
              animatedCanvasStyle,
            ]}
          >
            {/* Base map: changes only with theme, language or zoom tier. react-native-svg
                rasterises a whole Svg on any change, so everything that changes often (route,
                selection) lives in the small overlay Svg below, never here. */}
            <BaseMap
              palette={palette}
              theme={theme}
              language={language}
              layoutScale={layoutScale}
              fontRegular={fontRegular}
              fontBold={fontBold}
            />
            {routeData ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: palette.bg, opacity: 0.74 },
                ]}
              />
            ) : null}
            {routeData || selected ? (
              <Svg
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                width={CANVAS_W}
                height={CANVAS_H}
                viewBox={`${SVG_X0} ${SVG_Y0} ${CANVAS_W} ${CANVAS_H}`}
              >
                {routeData ? (
                  <>
                    <RouteOverlayLayer
                      palette={palette}
                      theme={theme}
                      routeData={routeData}
                      fontBold={fontBold}
                    />
                    <LabelsLayer
                      palette={palette}
                      language={language}
                      renderScale={layoutScale}
                      activeStationIds={routeData.stationIds}
                      fontRegular={fontRegular}
                      fontBold={fontBold}
                    />
                  </>
                ) : null}
                <SelectionLayer palette={palette} selectedId={selected} />
              </Svg>
            ) : null}
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  gestureSurface: {
    flex: 1,
  },
  canvasWrapper: {
    position: "absolute",
    left: 0,
    top: 0,
    transformOrigin: "left top",
  },
});

export default MetroMap;
