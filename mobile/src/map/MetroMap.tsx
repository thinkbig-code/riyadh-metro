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
  ZoomTier,
} from "./geometry";
import { computeBoundsForStationIds, findNearestStation } from "./labels";
import {
  BadgesLayer,
  DistrictsLayer,
  LabelsLayer,
  LandmarksLayer,
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
  bottomInset?: number;
  fontRegular?: string;
  fontBold?: string;
}

export interface MetroMapRef {
  fitNetwork: () => void;
  focus: (stationIds: string[]) => void;
}

const BOX = MAP_GEOMETRY.box;
const CANVAS_W = BOX.x1 - BOX.x0;
const CANVAS_H = BOX.y1 - BOX.y0;

const DEFAULT_CENTER_X = 535;
const DEFAULT_CENTER_Y = 645;
const DEFAULT_SCALE = 1.0;

const MIN_SCALE = 0.28;
const MAX_SCALE = 3.2;
const BOUND_MARGIN = 180;

function clampTranslation(
  tx: number,
  ty: number,
  scale: number,
  viewW: number,
  viewH: number,
): { x: number; y: number } {
  "worklet";
  if (viewW <= 0 || viewH <= 0) return { x: tx, y: ty };
  const scaledW = CANVAS_W * scale;
  const scaledH = CANVAS_H * scale;

  const minTx = Math.min(BOUND_MARGIN, viewW - scaledW - BOUND_MARGIN);
  const maxTx = Math.max(viewW - BOUND_MARGIN, BOUND_MARGIN);
  const minTy = Math.min(BOUND_MARGIN, viewH - scaledH - BOUND_MARGIN);
  const maxTy = Math.max(viewH - BOUND_MARGIN, BOUND_MARGIN);

  return {
    x: Math.min(maxTx, Math.max(minTx, tx)),
    y: Math.min(maxTy, Math.max(minTy, ty)),
  };
}

const MetroMap = forwardRef<MetroMapRef, MetroMapProps>(function MetroMap(
  {
    theme,
    language,
    selected,
    route,
    onStationPress,
    onLongPress,
    bottomInset = 0,
    fontRegular,
    fontBold,
  },
  ref,
) {
  const palette = MAP_GEOMETRY.colors[theme];
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [zoomTier, setZoomTier] = useState<ZoomTier>("normal");
  const [initialized, setInitialized] = useState(false);

  const scale = useSharedValue(DEFAULT_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(DEFAULT_SCALE);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);

  const syncZoomTier = useCallback((nextScale: number) => {
    const nextTier =
      nextScale < 0.68 ? "far" : nextScale >= 1.25 ? "close" : "normal";
    setZoomTier((prev) => (prev === nextTier ? prev : nextTier));
  }, []);

  const animateCameraTo = useCallback(
    (targetScale: number, targetTx: number, targetTy: number) => {
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
      const clamped = clampTranslation(
        targetTx,
        targetTy,
        clampedScale,
        viewport.width,
        viewport.height,
      );
      scale.value = withTiming(clampedScale, { duration: 260 });
      translateX.value = withTiming(clamped.x, { duration: 260 });
      translateY.value = withTiming(clamped.y, { duration: 260 });
      syncZoomTier(clampedScale);
    },
    [scale, syncZoomTier, translateX, translateY, viewport.height, viewport.width],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;
      setViewport({ width, height });

      if (!initialized) {
        const usableH = Math.max(200, height - bottomInset);
        const initScale = DEFAULT_SCALE;
        const localCenterX = DEFAULT_CENTER_X - BOX.x0;
        const localCenterY = DEFAULT_CENTER_Y - BOX.y0;
        const tx = width / 2 - localCenterX * initScale;
        const ty = usableH / 2 - localCenterY * initScale;
        const clamped = clampTranslation(tx, ty, initScale, width, height);
        scale.value = initScale;
        translateX.value = clamped.x;
        translateY.value = clamped.y;
        setInitialized(true);
      }
    },
    [bottomInset, initialized, scale, translateX, translateY],
  );

  const fitNetwork = useCallback(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const usableH = Math.max(200, viewport.height - bottomInset);
    const padX = 28;
    const padY = 42;
    const fitScale = Math.min(
      (viewport.width - padX * 2) / CANVAS_W,
      (usableH - padY * 2) / CANVAS_H,
    );
    const targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale));
    const tx = (viewport.width - CANVAS_W * targetScale) / 2;
    const ty = (usableH - CANVAS_H * targetScale) / 2;
    animateCameraTo(targetScale, tx, ty);
  }, [animateCameraTo, bottomInset, viewport.height, viewport.width]);

  const focus = useCallback(
    (stationIds: string[]) => {
      if (viewport.width <= 0 || viewport.height <= 0) return;
      const bounds = computeBoundsForStationIds(stationIds);
      if (!bounds) return;
      const usableH = Math.max(200, viewport.height - bottomInset);
      const spanX = Math.max(140, bounds.maxX - bounds.minX + 140);
      const spanY = Math.max(140, bounds.maxY - bounds.minY + 140);
      const targetScale = Math.min(
        1.45,
        Math.max(
          0.42,
          Math.min((viewport.width - 48) / spanX, (usableH - 64) / spanY),
        ),
      );
      const centerMapX = (bounds.minX + bounds.maxX) / 2 - BOX.x0;
      const centerMapY = (bounds.minY + bounds.maxY) / 2 - BOX.y0;
      const tx = viewport.width / 2 - centerMapX * targetScale;
      const ty = usableH / 2 - centerMapY * targetScale;
      animateCameraTo(targetScale, tx, ty);
    },
    [animateCameraTo, bottomInset, viewport.height, viewport.width],
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
    (screenX: number, screenY: number, currentTx: number, currentTy: number, currentScale: number) => {
      if (!onStationPress) return;
      const mapX = (screenX - currentTx) / currentScale + BOX.x0;
      const mapY = (screenY - currentTy) / currentScale + BOX.y0;
      const hitRadiusUnits = Math.max(14, 24 / currentScale);
      const hit = findNearestStation(mapX, mapY, hitRadiusUnits);
      if (hit) {
        onStationPress(hit.id);
      }
    },
    [onStationPress],
  );

  const handleLongPressOnJS = useCallback(
    (screenX: number, screenY: number, currentTx: number, currentTy: number, currentScale: number) => {
      if (!onLongPress) return;
      const mapX = (screenX - currentTx) / currentScale + BOX.x0;
      const mapY = (screenY - currentTy) / currentScale + BOX.y0;
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
          );
          translateX.value = next.x;
          translateY.value = next.y;
        }),
    [panStartX, panStartY, scale, translateX, translateY, viewport.height, viewport.width],
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
            Math.max(MIN_SCALE, pinchStartScale.value * e.scale),
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
          );
          scale.value = nextScale;
          translateX.value = clamped.x;
          translateY.value = clamped.y;
        })
        .onEnd(() => {
          runOnJS(syncZoomTier)(scale.value);
        }),
    [
      pinchFocalX,
      pinchFocalY,
      pinchStartScale,
      pinchStartX,
      pinchStartY,
      scale,
      syncZoomTier,
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
          );
          scale.value = withTiming(nextScale, { duration: 220 });
          translateX.value = withTiming(clamped.x, { duration: 220 });
          translateY.value = withTiming(clamped.y, { duration: 220 });
          runOnJS(syncZoomTier)(nextScale);
        }),
    [scale, syncZoomTier, translateX, translateY, viewport.height, viewport.width],
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
              viewBox={`${BOX.x0} ${BOX.y0} ${CANVAS_W} ${CANVAS_H}`}
            >
              <Rect
                x={BOX.x0}
                y={BOX.y0}
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
                zoomTier={zoomTier}
                fontRegular={fontRegular}
                fontBold={fontBold}
              />
              <LandmarksLayer palette={palette} zoomTier={zoomTier} />
              <LinesLayer palette={palette} dimmed={hasActiveRoute} />
              <BadgesLayer
                palette={palette}
                zoomTier={zoomTier}
                dimmed={hasActiveRoute}
                fontBold={fontBold}
              />
              <StationsLayer
                palette={palette}
                theme={theme}
                dimmed={hasActiveRoute}
              />
              <LabelsLayer
                palette={palette}
                language={language}
                zoomTier={zoomTier}
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
