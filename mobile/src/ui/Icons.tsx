import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

// Simple line icons drawn on a 24-unit grid, so they stay sharp at any size.

export function MenuIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 7h16M4 12h16M4 17h16"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// "my location": a target with a filled centre
export function LocateIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={6.5} stroke={color} strokeWidth={2} fill="none" />
      <Circle cx={12} cy={12} r={2.6} fill={color} />
      <Path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// "show the whole network": four corners pointing outwards
export function FitIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// a small chevron; "down" when a section is open, otherwise pointing to the reading direction end
export function ChevronIcon({
  color,
  open,
  rtl,
  size = 18,
}: {
  color: string;
  open: boolean;
  rtl: boolean;
  size?: number;
}) {
  const d = open ? "M6 9l6 6 6-6" : rtl ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// swap From and To: two arrows passing each other
export function SwapIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7 4v15M7 19l-3.5-3.5M7 19l3.5-3.5M17 20V5M17 5l-3.5 3.5M17 5l3.5 3.5"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
