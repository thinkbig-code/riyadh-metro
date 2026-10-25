import type { MetroEngine } from "./metro";
export function parseRouteLink(url: string, engine: MetroEngine) {
  try {
    const u = new URL(url);
    if (
      !(u.protocol === "https:" && u.hostname === "riyadhmetro.fyi") &&
      u.protocol !== "riyadhmetro:"
    )
      return null;
    const [from, to, language] = u.hash.slice(1).split("~");
    if (!engine.parseToken(from) || !engine.parseToken(to)) return null;
    return {
      from,
      to,
      language: engine.languages.some((l) => l.code === language)
        ? language
        : undefined,
    };
  } catch {
    return null;
  }
}
