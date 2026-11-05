import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// The app's pin logo, the same drawing as the app icon and the website icon.
export function PinLogo({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="194 120 636 784">
      <Path
        d="M512 120c-176 0-318 140-318 314 0 236 318 470 318 470s318-234 318-470c0-174-142-314-318-314z"
        fill="#E1251B"
      />
      <Rect x={362} y={262} width={300} height={300} rx={70} fill="#FFFFFF" />
      <Rect x={408} y={308} width={208} height={100} rx={22} fill="#E1251B" />
      <Circle cx={440} cy={488} r={26} fill="#E1251B" />
      <Circle cx={584} cy={488} r={26} fill="#E1251B" />
    </Svg>
  );
}

// Shown over the map for a moment after the system splash: the pin drops in, the name fades
// in, then everything fades away to reveal the map. About 1.3 s, touch passes through at the end.
export default function LaunchIntro({
  background,
  color,
  muted,
  title,
  subtitle,
}: {
  background: string;
  color: string;
  muted: string;
  title: string;
  subtitle: string;
}) {
  const [done, setDone] = useState(false);
  const pin = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(pin, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
        Animated.timing(text, {
          toValue: 1,
          duration: 380,
          delay: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(420),
      Animated.timing(fade, {
        toValue: 0,
        duration: 360,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => setDone(true));
  }, [fade, pin, text]);

  if (done) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: background, opacity: fade }]}
    >
      <Animated.View
        style={{
          transform: [
            { translateY: pin.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
            { scale: pin.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
          ],
        }}
      >
        <PinLogo size={112} />
      </Animated.View>
      <Animated.View
        style={{
          alignItems: "center",
          opacity: text,
          transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <Text style={[styles.title, { color }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    zIndex: 100,
    elevation: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
});
