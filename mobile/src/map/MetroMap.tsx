import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
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
} from "./geometry";
import { computeBoundsForStationIds, findNearestStation } from "./labels";
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

const BOX = MAP_GEOMETRY.box;
const NET_W = BOX.x1 - BOX.x0;
const NET_H = BOX.y1 - BOX.y0;

const SVG_PAD = 110;
const SVG_X0 = BOX.x0 - SVG_PAD;
const SVG_Y0 = BOX.y0 - SVG_PAD;
const CANVAS_W = NET_W + SVG_PAD * 2;
const CANVAS_H = NET_H + SVG_PAD * 2;

const DEFAULT_CENTER_X = 535;
const DEFAULT_CENTER_Y = 645;
const DEFAULT_SCALE = 1.0;
const MAX_SCALE = 3.0;

function computeFitScale(
  viewW: number,
  viewH: number,
  topInset: number,
  bottomInset: number,
): number {
  "worklet";
  if (viewW <= 0 || viewH <= 0) return 0.32;
  const usableH = Math.max(200, viewH - topInset - bottomInset);
  const padX = 14;
  const padY = 18;
  return Math.min(
    1.0,
    Math.max(
      0.22,
      Math.min((viewW - padX * 2) / NET_W, (usableH - padY * 2) / NET_H),
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

  const usableH = Math.max(200, viewH - topInset - bottomInset);
  const netScaledW = NET_W * scale;
  const netScaledH = NET_H * scale;
  const marginX = 24;
  const marginY = 24;

  let clampedX: number;
  if (netScaledW <= viewW - marginX * 2) {
    clampedX = viewW / 2 - (SVG_PAD + NET_W / 2) * scale;
  } else {
    const maxTx = marginX - SVG_PAD * scale;
    const minTx = viewW - marginX - (SVG_PAD + NET_W) * scale;
    clampedX = Math.min(maxTx, Math.max(minTx, tx));
  }

  let clampedY: number;
  if (netScaledH <= usableH - marginY * 2) {
    clampedY = topInset + usableH / 2 - (SVG_PAD + NET_H / 2) * scale;
  } else {
    const maxTy = topInset + marginY - SVG_PAD * scale;
    const minTy =
      viewH - bottomInset - marginY - (SVG_PAD + NET_H) * scale;
    clampedY = Math.min(maxTy, Math.max(minTy, ty));
  }

  return { x: clampedX, y: clampedY };
}

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

  const scale = useSharedValue(DEFAULT_SCALE);
  const minScaleShared = useSharedValue(0.32);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(DEFAULT_SCALE);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);

  const commitRenderScale = useCallback((nextScale: number) => {
    const quantized = Math.round(nextScale * 25) / 25;
    setRenderScale((prev) =>
      Math.abs(prev - quantized) < 0.03 ? prev : quantized,
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
      scale.value = withTiming(clampedScale, { duration: 260 });
      translateX.value = withTiming(clamped.x, { duration: 260 });
      translateY.value = withTiming(clamped.y, { duration: 260 });
      commitRenderScale(clampedScale);
    },
    [
      bottomInset,
      commitRenderScale,
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
      const spanX = Math.max(140, bounds.maxX - bounds.minX + 140);
      const spanY = Math.max(140, bounds.maxY - bounds.minY + 140);
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

  useEffect(() => {
    if (routeData && routeData.stationIds.size > 0 && initialized) {
      focus(Array.from(routeData.stationIds));
    }
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
        }),
    [
      bottomInset,
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
          pinchStartScale.value = scale.value;
          pinchStartX.value = translateX.value;
          pinchStartY.value = translateY.value;
          pinchFocalX.value = e.focalX;
          pinchFocalY.value = e.focalY;
        })
        .onUpdate((e) => {
          const nextScale = Math.min(
            MAX_SCALE,
            Math.max(minScaleShared.value, pinchStartScale.value * e.scale),
          );
          const ratio = nextScale / pinchStartScale.value;
          const rawTx =
            pinchFocalX.value - (pinchFocalX.value - pinchStartX.value) * ratio;
          const rawTy =
            pinchFocalY.value - (pinchFocalY.value - pinchStartY.value) * ratio;
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
        })
        .onEnd(() => {
          runOnJS(commitRenderScale)(scale.value);
        }),
    [
      bottomInset,
      commitRenderScale,
      minScaleShared,
      pinchFocalX,
      pinchFocalY,
      pinchStartScale,
      pinchStartX,
      pinchStartY,
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
        .onEnd((e) => {
          const currentScale = scale.value;
          const nextScale =
            currentScale >= 2.0
              ? DEFAULT_SCALE
              : Math.min(MAX_SCALE, currentScale * 1.65);
          const ratio = nextScale / currentScale;
          const rawTx = e.x - (e.x - translateX.value) * ratio;
          const rawTy = e.y - (e.y - translateY.value) * ratio;
          const clamped = clampTranslation(
            rawTx,
            rawTy,
            nextScale,
            viewport.width,
            viewport.height,
            topInset,
            bottomInset,
          );
          scale.value = withTiming(nextScale, { duration: 220 });
          translateX.value = withTiming(clamped.x, { duration: 220 });
          translateY.value = withTiming(clamped.y, { duration: 220 });
          runOnJS(commitRenderScale)(nextScale);
        }),
    [
      bottomInset,
      commitRenderScale,
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
        .onEnd((e) => {
          runOnJS(handleTapOnJS)(
            e.x,
            e.y,
            translateX.value,
            translateY.value,
            scale.value,
          );
        }),
    [handleTapOnJS, scale, translateX, translateY],
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(450)
        .onStart((e) => {
          runOnJS(handleLongPressOnJS)(
            e.x,
            e.y,
            translateX.value,
            translateY.value,
            scale.value,
          );
        }),
    [handleLongPressOnJS, scale, translateX, translateY],
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

  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const hasActiveRoute = Boolean(routeData);

  return (
    <View
      style={[styles.container, { backgroundColor: palette.bg }]}
      onLayout={onLayout}
    >
      <GestureDetector gesture={composedGesture}>
        <View style={styles.gestureSurface} collapsable={false}>
          <Animated.View
            renderToHardwareTextureAndroid
            style={[
              styles.canvasWrapper,
              { width: CANVAS_W, height: CANVAS_H },
              animatedCanvasStyle,
            ]}
          >
            <Svg
              width={CANVAS_W}
              height={CANVAS_H}
              viewBox={`${SVG_X0} ${SVG_Y0} ${CANVAS_W} ${CANVAS_H}`}
            >
              <Rect
                x={SVG_X0}
                y={SVG_Y0}
                width={CANVAS_W}
                height={CANVAS_H}
                fill={palette.bg}
              />
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
                renderScale={renderScale}
                fontRegular={fontRegular}
                fontBold={fontBold}
              />
              <LinesLayer palette={palette} dimmed={hasActiveRoute} />
              <StationsLayer
                palette={palette}
                theme={theme}
                dimmed={hasActiveRoute}
              />
              <BadgesLayer
                palette={palette}
                language={language}
                renderScale={renderScale}
                activeStationIds={routeData ? routeData.stationIds : null}
                dimmed={hasActiveRoute}
                fontBold={fontBold}
              />
              <LabelsLayer
                palette={palette}
                language={language}
                renderScale={renderScale}
                activeStationIds={routeData ? routeData.stationIds : null}
                fontRegular={fontRegular}
                fontBold={fontBold}
              />
              <RouteOverlayLayer
                palette={palette}
                theme={theme}
                routeData={routeData}
                fontBold={fontBold}
              />
              <SelectionLayer palette={palette} selectedId={selected} />
            </Svg>
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
    transformOrigin: "0px 0px",
  },
});

export default MetroMap;
