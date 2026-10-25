import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from "react-native";
import Svg, { Path, Circle, Text as SvgText, G } from "react-native-svg";
import type { MetroEngine, Route } from "../core/metro";

export const lineColors: Record<string, string> = {
  blue: "#1E6FD9",
  red: "#D82622",
  orange: "#E47A05",
  yellow: "#D5AD00",
  green: "#198940",
  purple: "#883CB4",
};
export default function MetroMap({
  engine,
  from,
  to,
  route,
  onStation,
  dark,
}: {
  engine: MetroEngine;
  from: string;
  to: string;
  route?: Route;
  onStation: (id: string) => void;
  dark: boolean;
}) {
  const stations = Object.values(engine.stations);
  const bounds = useMemo(() => {
    const xs = stations.map((s) => s.x),
      ys = stations.map((s) => s.y);
    return {
      x: Math.min(...xs) - 80,
      y: Math.min(...ys) - 60,
      w: Math.max(...xs) - Math.min(...xs) + 160,
      h: Math.max(...ys) - Math.min(...ys) + 120,
    };
  }, [engine]);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const current = useRef(view);
  current.current = view;
  const gesture = useRef({ x: 0, y: 0, zoom: 1, distance: 0 });
  const metrics = useRef({ bounds, size });
  metrics.current = { bounds, size };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.numberActiveTouches > 1 || Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderGrant: (e) => {
          const t = e.nativeEvent.touches;
          gesture.current = {
            ...current.current,
            distance:
              t.length > 1
                ? Math.hypot(t[1].pageX - t[0].pageX, t[1].pageY - t[0].pageY)
                : 0,
          };
        },
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches,
            b = gesture.current;
          if (t.length > 1) {
            const d = Math.hypot(
              t[1].pageX - t[0].pageX,
              t[1].pageY - t[0].pageY,
            );
            if (!b.distance) {
              gesture.current = { ...current.current, distance: d };
              return;
            }
            setView((v) => ({
              ...v,
              zoom: Math.max(1, Math.min(6, (b.zoom * d) / b.distance)),
            }));
          } else {
            const { bounds: box, size: dim } = metrics.current;
            const factor = Math.max(box.w / dim.w, box.h / dim.h) / b.zoom;
            setView({
              zoom: b.zoom,
              x: Math.max(-box.w, Math.min(box.w, b.x - g.dx * factor)),
              y: Math.max(-box.h, Math.min(box.h, b.y - g.dy * factor)),
            });
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );
  const active = new Set(route?.legs.flatMap((l) => l.stops || []) || []);
  const start = engine.parseToken(from)?.st,
    end = engine.parseToken(to)?.st;
  const w = bounds.w / view.zoom,
    h = bounds.h / view.zoom;
  const fg = dark ? "#EAF0F6" : "#142536",
    bg = dark ? "#152333" : "#F0F5F8";
  return (
    <View
      style={[styles.map, { backgroundColor: bg }]}
      onLayout={(e: LayoutChangeEvent) =>
        setSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`${bounds.x + (bounds.w - w) / 2 + view.x} ${bounds.y + (bounds.h - h) / 2 + view.y} ${w} ${h}`}
        >
          {engine.services.map((s) => (
            <Path
              key={s.id}
              d={engine.linePath(s.stops)}
              stroke={lineColors[s.line]}
              strokeWidth={9}
              fill="none"
              opacity={route?.rides ? 0.22 : 1}
            />
          ))}
          {route?.legs
            .filter((l) => l.type === "ride")
            .map((l, i) => (
              <Path
                key={i}
                d={engine.linePath(l.stops)}
                stroke={
                  lineColors[engine.services.find((s) => s.id === l.svc)!.line]
                }
                strokeWidth={11}
                fill="none"
              />
            ))}
          {stations.map((s) => (
            <G
              key={s.id}
              onPress={() => onStation(s.id)}
              accessibilityLabel={s.n}
            >
              <Circle cx={s.x} cy={s.y} r={20} fill="transparent" />
              <Circle
                cx={s.x}
                cy={s.y}
                r={
                  s.id === start || s.id === end
                    ? 11
                    : s.lines.size > 1
                      ? 7
                      : 4.5
                }
                fill={
                  s.id === start ? "#176A43" : s.id === end ? "#D34430" : bg
                }
                stroke={active.has(s.id) ? fg : lineColors[[...s.lines][0]]}
                strokeWidth={2.5}
              />
              {(view.zoom >= 2.2 ||
                s.lines.size > 1 ||
                s.id === start ||
                s.id === end) && (
                <SvgText
                  x={s.x + 12}
                  y={s.y - 10}
                  fill={fg}
                  fontSize={11}
                  fontWeight="600"
                >
                  {s.n}
                </SvgText>
              )}
            </G>
          ))}
        </Svg>
      </View>
      <View style={styles.controls}>
        {[
          [
            "+",
            () => setView((v) => ({ ...v, zoom: Math.min(6, v.zoom * 1.5) })),
          ],
          [
            "−",
            () => setView((v) => ({ ...v, zoom: Math.max(1, v.zoom / 1.5) })),
          ],
          ["⊙", () => setView({ x: 0, y: 0, zoom: 1 })],
        ].map(([label, fn], i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={engine.text(["zin", "zout", "zfit"][i])}
            onPress={fn as () => void}
            style={[
              styles.button,
              { backgroundColor: dark ? "#24364B" : "white" },
            ]}
          >
            <Text style={{ color: fg, fontSize: 23 }}>{label as string}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  map: { flex: 1, minHeight: 200 },
  controls: { position: "absolute", right: 12, bottom: 12, gap: 6 },
  button: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
});
