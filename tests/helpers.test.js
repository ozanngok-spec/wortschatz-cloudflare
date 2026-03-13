import { describe, it, expect } from "vitest";
import {
  TYPE_FILTERS,
  matchesTypeFilter,
  typeColor,
  levelColor,
  parseAutoTags,
  buildSpotifySource,
} from "../src/lib/helpers.js";

// ── Mock words ────────────────────────────────────────────────────────────────
const nomen = { word: "der Hund", type: "Nomen", mastered: false };
const verb = { word: "laufen", type: "Verb", mastered: true };
const adj = { word: "schnell", type: "Adjektiv", mastered: false };
const adverb = { word: "trotzdem", type: "Adverb", mastered: false };
const ausdruck = { word: "Na klar!", type: "Ausdruck", mastered: false };
const redewendung = {
  word: "ins Gras beißen",
  type: "Redewendung",
  mastered: false,
};
const noType = { word: "xyz", type: "", mastered: false };
const mastered = { word: "gut", type: "Adjektiv", mastered: true };

// ── TYPE_FILTERS ──────────────────────────────────────────────────────────────
describe("TYPE_FILTERS", () => {
  it("has expected filter keys", () => {
    const keys = TYPE_FILTERS.map((f) => f.key);
    expect(keys).toContain("all");
    expect(keys).toContain("nomen");
    expect(keys).toContain("verb");
    expect(keys).toContain("ausdruck");
    expect(keys).toContain("adjektiv");
    expect(keys).toContain("adverb");
    expect(keys).toContain("mastered");
  });
});

// ── matchesTypeFilter ─────────────────────────────────────────────────────────
describe("matchesTypeFilter", () => {
  it('"all" matches everything', () => {
    expect(matchesTypeFilter(nomen, "all")).toBe(true);
    expect(matchesTypeFilter(verb, "all")).toBe(true);
    expect(matchesTypeFilter(noType, "all")).toBe(true);
  });

  it('"mastered" only matches mastered words', () => {
    expect(matchesTypeFilter(mastered, "mastered")).toBe(true);
    expect(matchesTypeFilter(nomen, "mastered")).toBe(false);
  });

  it('"nomen" matches type containing Nomen or Noun', () => {
    expect(matchesTypeFilter(nomen, "nomen")).toBe(true);
    expect(matchesTypeFilter({ type: "Noun" }, "nomen")).toBe(true);
    expect(matchesTypeFilter(verb, "nomen")).toBe(false);
  });

  it('"verb" matches Verb type', () => {
    expect(matchesTypeFilter(verb, "verb")).toBe(true);
    expect(matchesTypeFilter(nomen, "verb")).toBe(false);
  });

  it('"ausdruck" matches Ausdruck, Expression, Phrase, Redewendung', () => {
    expect(matchesTypeFilter(ausdruck, "ausdruck")).toBe(true);
    expect(matchesTypeFilter(redewendung, "ausdruck")).toBe(true);
    expect(matchesTypeFilter({ type: "Expression" }, "ausdruck")).toBe(true);
    expect(matchesTypeFilter({ type: "Phrase" }, "ausdruck")).toBe(true);
    expect(matchesTypeFilter(verb, "ausdruck")).toBe(false);
  });

  it('"adjektiv" matches types containing adj', () => {
    expect(matchesTypeFilter(adj, "adjektiv")).toBe(true);
    expect(matchesTypeFilter({ type: "Adjective" }, "adjektiv")).toBe(true);
    expect(matchesTypeFilter(verb, "adjektiv")).toBe(false);
  });

  it('"adverb" matches Adverb', () => {
    expect(matchesTypeFilter(adverb, "adverb")).toBe(true);
    expect(matchesTypeFilter(verb, "adverb")).toBe(false);
  });

  it("unknown filter returns true (fallback)", () => {
    expect(matchesTypeFilter(nomen, "unknown")).toBe(true);
  });
});

// ── typeColor ─────────────────────────────────────────────────────────────────
describe("typeColor", () => {
  const dark = { isDark: true };
  const light = { isDark: false };

  it("returns distinct colors for each type in dark mode", () => {
    const nomenC = typeColor("Nomen", dark);
    const verbC = typeColor("Verb", dark);
    const adjC = typeColor("Adjektiv", dark);
    const advC = typeColor("Adverb", dark);
    const exprC = typeColor("Ausdruck", dark);

    expect(nomenC.bg).not.toBe(verbC.bg);
    expect(adjC.bg).not.toBe(advC.bg);
    expect(exprC.bg).not.toBe(nomenC.bg);
  });

  it("returns distinct colors for each type in light mode", () => {
    const nomenC = typeColor("Nomen", light);
    const verbC = typeColor("Verb", light);
    expect(nomenC.bg).not.toBe(verbC.bg);
    expect(nomenC.text).not.toBe(verbC.text);
  });

  it("returns fallback for unknown type", () => {
    const c = typeColor("Sonstiges", dark);
    expect(c).toHaveProperty("bg");
    expect(c).toHaveProperty("text");
  });

  it("handles null/undefined type gracefully", () => {
    expect(() => typeColor(null, dark)).not.toThrow();
    expect(() => typeColor(undefined, light)).not.toThrow();
  });
});

// ── levelColor ────────────────────────────────────────────────────────────────
describe("levelColor", () => {
  const dark = { isDark: true };
  const light = { isDark: false };

  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];

  it("returns unique colors for all CEFR levels (dark)", () => {
    const colors = levels.map((l) => levelColor(l, dark));
    const bgs = colors.map((c) => c.bg);
    expect(new Set(bgs).size).toBe(levels.length);
  });

  it("returns unique colors for all CEFR levels (light)", () => {
    const colors = levels.map((l) => levelColor(l, light));
    const bgs = colors.map((c) => c.bg);
    expect(new Set(bgs).size).toBe(levels.length);
  });

  it("handles lowercase and extra whitespace", () => {
    const c = levelColor("  b1 ", dark);
    expect(c.bg).toBe(levelColor("B1", dark).bg);
  });

  it("returns fallback for unknown level", () => {
    const c = levelColor("X9", dark);
    expect(c).toHaveProperty("bg");
    expect(c).toHaveProperty("text");
  });

  it("handles null/undefined", () => {
    expect(() => levelColor(null, dark)).not.toThrow();
    expect(() => levelColor(undefined, null)).not.toThrow();
  });
});

// ── parseAutoTags ─────────────────────────────────────────────────────────────
describe("parseAutoTags", () => {
  it("extracts and lowercases valid tags", () => {
    expect(parseAutoTags(["Reise", "Kultur"])).toEqual(["reise", "kultur"]);
  });

  it("trims whitespace", () => {
    expect(parseAutoTags(["  essen ", "alltag"])).toEqual(["essen", "alltag"]);
  });

  it("filters out empty strings", () => {
    expect(parseAutoTags(["natur", "", "  "])).toEqual(["natur"]);
  });

  it("returns empty array for non-array input", () => {
    expect(parseAutoTags(null)).toEqual([]);
    expect(parseAutoTags(undefined)).toEqual([]);
    expect(parseAutoTags("not-an-array")).toEqual([]);
    expect(parseAutoTags(42)).toEqual([]);
  });

  it("handles empty array", () => {
    expect(parseAutoTags([])).toEqual([]);
  });

  it("coerces non-string items to strings", () => {
    expect(parseAutoTags([123, true])).toEqual(["123", "true"]);
  });
});

// ── buildSpotifySource ────────────────────────────────────────────────────────
describe("buildSpotifySource", () => {
  it("builds source label with track and artist", () => {
    expect(buildSpotifySource("99 Luftballons", "Nena")).toBe(
      "🎵 99 Luftballons – Nena"
    );
  });

  it("works without artist name", () => {
    expect(buildSpotifySource("Atemlos", null)).toBe("🎵 Atemlos");
    expect(buildSpotifySource("Atemlos", "")).toBe("🎵 Atemlos");
  });

  it("returns null for missing track name", () => {
    expect(buildSpotifySource(null, "Nena")).toBeNull();
    expect(buildSpotifySource("", "Nena")).toBeNull();
  });
});
