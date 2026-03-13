import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchLyrics } from "../src/lib/lyrics.js";

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_LRCLIB_RESULTS = [
  {
    id: 123,
    trackName: "99 Luftballons",
    artistName: "Nena",
    plainLyrics:
      "Hast du etwas Zeit für mich?\nDann singe ich ein Lied für dich\nVon 99 Luftballons\nAuf ihrem Weg zum Horizont",
    syncedLyrics:
      "[00:12.00]Hast du etwas Zeit für mich?\n[00:15.50]Dann singe ich ein Lied für dich",
  },
  {
    id: 456,
    trackName: "99 Luftballons",
    artistName: "Nena",
    plainLyrics: "Some alternate version...",
    syncedLyrics: null,
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchLyrics", () => {
  it("returns plainLyrics and syncedLyrics from first result", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_LRCLIB_RESULTS),
    });

    const result = await fetchLyrics("99 Luftballons", "Nena");

    expect(fetch).toHaveBeenCalledOnce();
    const url = fetch.mock.calls[0][0];
    expect(url).toContain("lrclib.net/api/search");
    expect(url).toContain("track_name=99+Luftballons");
    expect(url).toContain("artist_name=Nena");

    expect(result).toEqual({
      plainLyrics: MOCK_LRCLIB_RESULTS[0].plainLyrics,
      syncedLyrics: MOCK_LRCLIB_RESULTS[0].syncedLyrics,
    });
  });

  it("returns null for empty results array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const result = await fetchLyrics("Unknown Song", "Unknown Artist");
    expect(result).toBeNull();
  });

  it("returns null on HTTP error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await fetchLyrics("Test", "Test");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await fetchLyrics("Test", "Test");
    expect(result).toBeNull();
  });

  it("handles result with null plainLyrics", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { plainLyrics: null, syncedLyrics: "[00:00.00]Test" },
        ]),
    });

    const result = await fetchLyrics("Test", "Test");
    expect(result).toEqual({
      plainLyrics: null,
      syncedLyrics: "[00:00.00]Test",
    });
  });

  it("encodes special characters in query parameters", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await fetchLyrics("Über den Wolken", "Reinhard Mey");

    const url = fetch.mock.calls[0][0];
    expect(url).toContain("%C3%9Cber");
  });
});
