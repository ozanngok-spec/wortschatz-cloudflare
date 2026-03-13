import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_CLAUDE_WORD = {
  word: "die Gelassenheit",
  translation: "composure, serenity",
  type: "Nomen",
  level: "B2",
  explanation: "Beschreibt einen Zustand innerer Ruhe.",
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
  tags: ["gefühle", "persönlichkeit"],
};

const MOCK_PRONUNCIATION = {
  score: 85,
  feedback: "Sehr gut!",
  highlights: [
    { token: "Ge", quality: "gut" },
    { token: "las", quality: "gut" },
    { token: "sen", quality: "mittel" },
    { token: "heit", quality: "gut" },
  ],
};

const MOCK_WOTD = {
  word: "der Ohrwurm",
  translation: "earworm",
  type: "Nomen",
  level: "B2",
  explanation: "Ein Lied, das man nicht aus dem Kopf bekommt.",
  sentences: [
    { german: "Das ist ein Ohrwurm.", english: "That's an earworm." },
    { german: "Ich habe einen Ohrwurm.", english: "I have an earworm." },
  ],
  forms: "der Ohrwurm (die Ohrwürmer)",
  funFact: "Kombiniert Ohr + Wurm.",
  tags: ["musik", "alltag"],
};

const MOCK_SPOTIFY_GERMAN = {
  language: "Deutsch",
  isGerman: true,
  words: [
    { word: "der Luftballon", translation: "balloon", type: "Nomen" },
    { word: "der Horizont", translation: "horizon", type: "Nomen" },
  ],
};

const MOCK_SPOTIFY_ENGLISH = {
  language: "Englisch",
  isGerman: false,
  words: [],
};

// ── Import worker (we test the fetch handler) ─────────────────────────────────
let workerDefault;

beforeEach(async () => {
  vi.restoreAllMocks();

  // Mock global fetch for Claude API calls
  global.fetch = vi.fn();

  // Dynamically import to get fresh module
  vi.resetModules();
  const mod = await import("../worker.js");
  workerDefault = mod.default;
});

// Helper to create a Request
function makeReq(method, path, body) {
  const url = `https://mein-wortschatz.ozann-gok.workers.dev${path}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(url, opts);
}

const mockEnv = {
  ANTHROPIC_API_KEY: "test-key-123",
  ASSETS: {
    fetch: vi.fn(() => new Response("<!DOCTYPE html>...", { status: 200 })),
  },
};

// ── CORS preflight ────────────────────────────────────────────────────────────
describe("CORS preflight", () => {
  it("OPTIONS returns CORS headers", async () => {
    const req = new Request("https://test.com/claude", { method: "OPTIONS" });
    const res = await workerDefault.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

// ── /claude route ─────────────────────────────────────────────────────────────
describe("POST /claude", () => {
  it("returns word analysis JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: JSON.stringify(MOCK_CLAUDE_WORD) }],
        }),
    });

    const req = makeReq("POST", "/claude", { word: "Gelassenheit" });
    const res = await workerDefault.fetch(req, mockEnv);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.word).toBe("die Gelassenheit");
    expect(data.type).toBe("Nomen");
    expect(data.sentences).toHaveLength(3);
    expect(data.tags).toEqual(["gefühle", "persönlichkeit"]);

    // Verify Claude was called with the right API key
    const [apiUrl, apiOpts] = global.fetch.mock.calls[0];
    expect(apiUrl).toContain("anthropic.com");
    expect(apiOpts.headers["x-api-key"]).toBe("test-key-123");

    // Verify the prompt asks for tags
    const body = JSON.parse(apiOpts.body);
    expect(body.messages[0].content).toContain('"tags"');
  });

  it("prompt requests tags field", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: JSON.stringify(MOCK_CLAUDE_WORD) }],
        }),
    });

    const req = makeReq("POST", "/claude", { word: "test" });
    await workerDefault.fetch(req, mockEnv);

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const prompt = body.messages[0].content;
    expect(prompt).toContain("tags");
    expect(prompt).toContain("topic");
  });

  it("forwards Claude API errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    });

    const req = makeReq("POST", "/claude", { word: "test" });
    await expect(workerDefault.fetch(req, mockEnv)).rejects.toThrow();
  });
});

// ── /pronounce route ──────────────────────────────────────────────────────────
describe("POST /pronounce", () => {
  it("returns pronunciation feedback", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: JSON.stringify(MOCK_PRONUNCIATION) }],
        }),
    });

    const req = makeReq("POST", "/pronounce", {
      word: "Gelassenheit",
      transcript: "gelassenheit",
    });
    const res = await workerDefault.fetch(req, mockEnv);
    const data = await res.json();

    expect(data.score).toBe(85);
    expect(data.highlights).toHaveLength(4);
    expect(data.highlights[0].quality).toBe("gut");
  });
});

// ── /wotd route ───────────────────────────────────────────────────────────────
describe("GET /wotd", () => {
  it("returns word of the day", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: JSON.stringify(MOCK_WOTD) }],
        }),
    });

    const req = new Request("https://test.com/wotd", { method: "GET" });
    const res = await workerDefault.fetch(req, mockEnv);
    const data = await res.json();

    expect(data.word).toBe("der Ohrwurm");
    expect(data.level).toBe("B2");
    expect(data).toHaveProperty("funFact");
    expect(data.tags).toEqual(["musik", "alltag"]);
  });

  it("prompt requests tags field", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: JSON.stringify(MOCK_WOTD) }],
        }),
    });

    const req = new Request("https://test.com/wotd", { method: "GET" });
    await workerDefault.fetch(req, mockEnv);

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const prompt = body.messages[0].content;
    expect(prompt).toContain('"tags"');
    expect(prompt).toContain("topic");
  });
});

// ── /spotify-vocab route ──────────────────────────────────────────────────────
describe("POST /spotify-vocab", () => {
  it("returns German vocab when song is German", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: JSON.stringify(MOCK_SPOTIFY_GERMAN) }],
        }),
    });

    const req = makeReq("POST", "/spotify-vocab", {
      title: "99 Luftballons",
      artist: "Nena",
      lyrics: "Hast du etwas Zeit für mich?",
    });
    const res = await workerDefault.fetch(req, mockEnv);
    const data = await res.json();

    expect(data.isGerman).toBe(true);
    expect(data.language).toBe("Deutsch");
    expect(data.words.length).toBeGreaterThan(0);
  });

  it("returns non-German result for English songs", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: JSON.stringify(MOCK_SPOTIFY_ENGLISH) }],
        }),
    });

    const req = makeReq("POST", "/spotify-vocab", {
      title: "Bohemian Rhapsody",
      artist: "Queen",
      lyrics: "Is this the real life?",
    });
    const res = await workerDefault.fetch(req, mockEnv);
    const data = await res.json();

    expect(data.isGerman).toBe(false);
    expect(data.words).toHaveLength(0);
  });

  it("handles null lyrics (language-only detection)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: JSON.stringify(MOCK_SPOTIFY_ENGLISH) }],
        }),
    });

    const req = makeReq("POST", "/spotify-vocab", {
      title: "Shape of You",
      artist: "Ed Sheeran",
      lyrics: null,
    });
    const res = await workerDefault.fetch(req, mockEnv);
    const data = await res.json();

    expect(data).toHaveProperty("language");
    expect(data).toHaveProperty("isGerman");

    // Verify the Claude prompt mentions no lyrics
    const claudeBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(claudeBody.messages[0].content).toContain("No lyrics available");
  });
});

// ── /youtube-vocab route ──────────────────────────────────────────────────────
const MOCK_YOUTUBE_RESULT = {
  expressions: [
    { word: "sich herausstellen", translation: "to turn out", type: "Verb", context: "Es hat sich herausgestellt, dass…", tags: ["alltag"] },
    { word: "die Herausforderung", translation: "the challenge", type: "Nomen", context: "eine große Herausforderung für uns alle", tags: ["arbeit"] },
  ],
};

describe("POST /youtube-vocab", () => {
  it("returns 400 for missing URL", async () => {
    const req = makeReq("POST", "/youtube-vocab", {});
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("URL");
  });

  it("returns 400 for invalid YouTube URL", async () => {
    const req = makeReq("POST", "/youtube-vocab", { url: "https://example.com" });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid");
  });

  it("returns no_captions when page has no captions data", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<html><title>Test Video - YouTube</title><body>no captions here</body></html>"),
    });

    const req = makeReq("POST", "/youtube-vocab", { url: "https://youtube.com/watch?v=dQw4w9WgXcQ" });
    const res = await workerDefault.fetch(req, mockEnv);
    const data = await res.json();

    expect(data.error).toBe("no_captions");
    expect(data.title).toBe("Test Video");
  });

  it("extracts expressions when German captions are available", async () => {
    // Mock: 1st call = YouTube page with captions, 2nd call = caption XML, 3rd call = Claude API
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url) => {
      callCount++;
      if (callCount === 1) {
        // YouTube page with caption tracks
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`<html><title>Deutsch lernen - YouTube</title><body>
            "captions": {"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=test&lang=de","name":{"simpleText":"German"},"languageCode":"de"}]}}, "videoDetails"
          </body></html>`),
        });
      }
      if (callCount === 2) {
        // Caption XML
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<transcript><text start="0" dur="5">Es hat sich herausgestellt, dass dies eine große Herausforderung ist.</text></transcript>'),
        });
      }
      // Claude API
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(MOCK_YOUTUBE_RESULT) }],
        }),
      });
    });

    const req = makeReq("POST", "/youtube-vocab", { url: "https://youtube.com/watch?v=abcdefghijk" });
    const res = await workerDefault.fetch(req, mockEnv);
    const data = await res.json();

    expect(data.title).toBe("Deutsch lernen");
    expect(data.expressions).toHaveLength(2);
    expect(data.expressions[0].word).toBe("sich herausstellen");
    expect(data.expressions[0]).toHaveProperty("context");
    expect(data.expressions[0]).toHaveProperty("tags");
  });
});

// ── Static asset fallback ─────────────────────────────────────────────────────
describe("Asset fallback", () => {
  it("unknown paths fall through to ASSETS binding", async () => {
    const req = new Request("https://test.com/index.html", { method: "GET" });
    await workerDefault.fetch(req, mockEnv);

    expect(mockEnv.ASSETS.fetch).toHaveBeenCalled();
  });
});
