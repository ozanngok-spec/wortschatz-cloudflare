import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchExampleSentences,
  fetchPronunciationFeedback,
  fetchWordOfTheDay,
} from "../src/lib/api.js";

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_WORD_RESPONSE = {
  word: "die Gelassenheit",
  translation: "composure, serenity",
  type: "Nomen",
  level: "B2",
  explanation: "Beschreibt einen Zustand innerer Ruhe und Ausgeglichenheit.",
  sentences: [
    {
      german: "Sie bewunderte seine Gelassenheit.",
      english: "She admired his composure.",
    },
    {
      german: "Mit Gelassenheit meisterte er die Krise.",
      english: "He mastered the crisis with serenity.",
    },
    {
      german: "Gelassenheit ist eine Tugend.",
      english: "Composure is a virtue.",
    },
  ],
  forms: "die Gelassenheit (die Gelassenheiten)",
};

const MOCK_PRONUNCIATION = {
  score: 72,
  feedback:
    "Gut gemacht! Die Betonung war richtig, aber das 'ch' könnte weicher sein.",
  highlights: [
    { token: "Ge", quality: "gut" },
    { token: "las", quality: "gut" },
    { token: "sen", quality: "mittel" },
    { token: "heit", quality: "gut" },
  ],
};

const MOCK_WOTD = {
  word: "der Ohrwurm",
  translation: "earworm (a catchy song stuck in your head)",
  type: "Nomen",
  level: "B2",
  explanation:
    "Ein Ohrwurm ist ein Lied, das man nicht mehr aus dem Kopf bekommt.",
  sentences: [
    {
      german: "Dieses Lied ist ein totaler Ohrwurm.",
      english: "This song is a total earworm.",
    },
    {
      german: "Ich habe seit Tagen einen Ohrwurm.",
      english: "I've had an earworm for days.",
    },
  ],
  forms: "der Ohrwurm (die Ohrwürmer)",
  funFact:
    "Das Wort kombiniert 'Ohr' (ear) und 'Wurm' (worm) — ein Wurm, der sich ins Ohr bohrt.",
};

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.restoreAllMocks();
});

// ── fetchExampleSentences ─────────────────────────────────────────────────────
describe("fetchExampleSentences", () => {
  it("sends correct POST request and returns JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_WORD_RESPONSE),
    });

    const result = await fetchExampleSentences("Gelassenheit");

    expect(fetch).toHaveBeenCalledWith("/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: "Gelassenheit" }),
    });
    expect(result).toEqual(MOCK_WORD_RESPONSE);
    expect(result.sentences).toHaveLength(3);
    expect(result.type).toBe("Nomen");
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(fetchExampleSentences("fail")).rejects.toThrow(
      "Proxy error 500"
    );
  });

  it("returns all expected fields in response shape", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_WORD_RESPONSE),
    });

    const result = await fetchExampleSentences("test");
    const keys = Object.keys(result);
    expect(keys).toContain("word");
    expect(keys).toContain("translation");
    expect(keys).toContain("type");
    expect(keys).toContain("level");
    expect(keys).toContain("explanation");
    expect(keys).toContain("sentences");
    expect(keys).toContain("forms");
  });
});

// ── fetchPronunciationFeedback ────────────────────────────────────────────────
describe("fetchPronunciationFeedback", () => {
  it("sends word and transcript, returns feedback", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_PRONUNCIATION),
    });

    const result = await fetchPronunciationFeedback(
      "Gelassenheit",
      "gelassenheit"
    );

    expect(fetch).toHaveBeenCalledWith("/pronounce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: "Gelassenheit",
        transcript: "gelassenheit",
      }),
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.highlights).toBeInstanceOf(Array);
    expect(result.highlights[0]).toHaveProperty("token");
    expect(result.highlights[0]).toHaveProperty("quality");
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    });

    await expect(fetchPronunciationFeedback("fail", "fail")).rejects.toThrow(
      "Proxy error 502"
    );
  });
});

// ── fetchWordOfTheDay ─────────────────────────────────────────────────────────
describe("fetchWordOfTheDay", () => {
  it("fetches WOTD via GET and returns expected shape", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_WOTD),
    });

    const result = await fetchWordOfTheDay();

    expect(fetch).toHaveBeenCalledWith("/wotd");
    expect(result.word).toBe("der Ohrwurm");
    expect(result.sentences).toHaveLength(2);
    expect(result).toHaveProperty("funFact");
  });

  it("throws on error response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    await expect(fetchWordOfTheDay()).rejects.toThrow("WOTD error 503");
  });
});
