export interface Station {
  id: string;
  n: string;
  en: string;
  x: number;
  y: number;
  lines: Set<string>;
}
export interface Leg {
  type: "ride" | "xfer" | "walk";
  svc: string;
  from?: string;
  to?: string;
  t?: number;
  stops: string[];
}
export interface Route {
  legs: Leg[];
  time: number;
  timeMax: number;
  walk: number;
  xf: number;
  rides: number;
  stops: number;
  sig: string;
  modes: string[];
}
export interface SearchHit {
  id?: string;
  place?: { id: string; n: string; st: string; min: number; note?: string };
  score: number;
}
export interface MetroEngine {
  stations: Record<string, Station>;
  services: { id: string; line: string; stops: string[] }[];
  languages: { code: string; native: string; rtl?: boolean }[];
  fares: { std: number; first: number; minutes: number };
  places: { id: string; n: string; st: string; min: number; note?: string }[];
  parkAndRide: Set<string>;
  stationNumbers: Record<string, number>;
  setLanguage(code: string): void;
  text(key: string, vars?: Record<string, string | number>): string;
  name(token: string): string;
  stationName(id: string): string;
  lineName(id: string): string;
  linePath(ids: string[]): string;
  direction(leg: Leg): string;
  search(q: string): SearchHit[];
  parseToken(
    token: string,
  ): { st: string; lm?: { min: number; note?: string } } | null;
  nearestStation(point: [number, number]): { id: string; d: number } | null;
  plan(from: string, to: string, departMs?: number): Route[];
  shareUrl(from: string, to: string): string;
  serviceState(ms?: number): { open: boolean; opens?: number; close?: number };
}
export function createMetroEngine(): MetroEngine;
