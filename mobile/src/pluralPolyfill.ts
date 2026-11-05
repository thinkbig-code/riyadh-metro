// Hermes on Android may ship without Intl.PluralRules; the site texts use it to pick
// "1 stop" vs "2 stops" (and the Arabic and Russian forms). Minimal rules for the 8 app
// languages, installed only when the real one is missing.
type Cat = "zero" | "one" | "two" | "few" | "many" | "other";

function select(lang: string, n: number): Cat {
  const i = Math.floor(Math.abs(n));
  const isInt = i === Math.abs(n);
  switch (lang.slice(0, 2)) {
    case "ar": {
      if (n === 0) return "zero";
      if (n === 1) return "one";
      if (n === 2) return "two";
      const m = i % 100;
      if (isInt && m >= 3 && m <= 10) return "few";
      if (isInt && m >= 11 && m <= 99) return "many";
      return "other";
    }
    case "ru": {
      if (!isInt) return "other";
      const m10 = i % 10;
      const m100 = i % 100;
      if (m10 === 1 && m100 !== 11) return "one";
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "few";
      return "many";
    }
    case "fr":
    case "hi":
    case "bn":
      return i === 0 || i === 1 ? "one" : "other";
    default:
      // en, ur, tl
      return n === 1 ? "one" : "other";
  }
}

const g = globalThis as unknown as { Intl?: Record<string, unknown> };
if (!g.Intl) g.Intl = {};
let works = false;
try {
  works = new Intl.PluralRules("en").select(1) === "one";
} catch {
  works = false;
}
if (!works) {
  class PluralRules {
    private lang: string;
    constructor(locale?: string | string[]) {
      this.lang = (Array.isArray(locale) ? locale[0] : locale) || "en";
    }
    select(n: number): Cat {
      return select(this.lang, Number(n));
    }
  }
  g.Intl.PluralRules = PluralRules;
}

export {};
