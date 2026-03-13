import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTokens,
  clearTokens,
  isConnected,
  getCurrentlyPlaying,
} from "../src/lib/spotify.js";

// ── localStorage mock ─────────────────────────────────────────────────────────
const localStore = {};
const localStorageMock = {
  getItem: vi.fn((key) => localStore[key] || null),
  setItem: vi.fn((key, val) => { localStore[key] = val; }),
  removeItem: vi.fn((key) => { delete localStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStore).forEach((k) => delete localStore[k]); }),
};
vi.stubGlobal("localStorage", localStorageMock);

// ── sessionStorage mock ───────────────────────────────────────────────────────
const sessionStore = {};
vi.stubGlobal("sessionStorage", {
  getItem: vi.fn((key) => sessionStore[key] || null),
  setItem: vi.fn((key, val) => { sessionStore[key] = val; }),
  removeItem: vi.fn((key) => { delete sessionStore[key]; }),
});

// ── window.location mock ──────────────────────────────────────────────────────
vi.stubGlobal("window", {
  ...globalThis.window,
  location: {
    origin: "https://mein-wortschatz.ozann-gok.workers.dev",
    search: "",
    pathname: "/",
    href: "",
  },
  history: { replaceState: vi.fn() },
});

// ── Mock Spotify API response ─────────────────────────────────────────────────
const MOCK_CURRENTLY_PLAYING = {
  is_playing: true,
  progress_ms: 45000,
  item: {
    id: "track123",
    name: "99 Luftballons",
    artists: [{ name: "Nena" }],
    album: {
      name: "99 Luftballons (Album)",
      images: [
        { url: "https://i.scdn.co/image/large.jpg", height: 640 },
        { url: "https://i.scdn.co/image/medium.jpg", height: 300 },
      ],
    },
    duration_ms: 230000,
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
  localStorageMock.clear();
  // re-bind since clear removes them
  localStorageMock.getItem = vi.fn((key) => localStore[key] || null);
  localStorageMock.setItem = vi.fn((key, val) => { localStore[key] = val; });
  localStorageMock.removeItem = vi.fn((key) => { delete localStore[key]; });
});

// ── Token management ──────────────────────────────────────────────────────────
describe("Token management", () => {
  it("getTokens returns null when no tokens stored", () => {
    expect(getTokens("user1")).toBeNull();
  });

  it("getTokens returns parsed tokens when stored", () => {
    const tokens = {
      access_token: "abc123",
      refresh_token: "ref456",
      expiresAt: Date.now() + 3600000,
    };
    localStore["wortschatz-spotify-user1"] = JSON.stringify(tokens);

    const result = getTokens("user1");
    expect(result.access_token).toBe("abc123");
    expect(result.refresh_token).toBe("ref456");
  });

  it("clearTokens removes stored tokens", () => {
    localStore["wortschatz-spotify-user1"] = JSON.stringify({ access_token: "x" });
    clearTokens("user1");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("wortschatz-spotify-user1");
  });

  it("isConnected returns true when tokens exist", () => {
    localStore["wortschatz-spotify-user1"] = JSON.stringify({
      access_token: "valid_token",
    });
    expect(isConnected("user1")).toBe(true);
  });

  it("isConnected returns false when no tokens", () => {
    expect(isConnected("user1")).toBe(false);
  });

  it("tokens are per-user (different keys)", () => {
    localStore["wortschatz-spotify-alice"] = JSON.stringify({ access_token: "alice_token" });
    localStore["wortschatz-spotify-bob"] = JSON.stringify({ access_token: "bob_token" });

    expect(getTokens("alice").access_token).toBe("alice_token");
    expect(getTokens("bob").access_token).toBe("bob_token");
  });
});

// ── getCurrentlyPlaying ───────────────────────────────────────────────────────
describe("getCurrentlyPlaying", () => {
  it("returns formatted track data on success", async () => {
    const tokens = {
      access_token: "valid",
      refresh_token: "ref",
      expiresAt: Date.now() + 3600000,
    };
    localStore["wortschatz-spotify-user1"] = JSON.stringify(tokens);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_CURRENTLY_PLAYING),
    });

    const result = await getCurrentlyPlaying("user1");

    expect(result).toEqual({
      id: "track123",
      name: "99 Luftballons",
      artist: "Nena",
      album: "99 Luftballons (Album)",
      albumArt: "https://i.scdn.co/image/medium.jpg",
      isPlaying: true,
      progressMs: 45000,
      durationMs: 230000,
    });
  });

  it("returns null when nothing is playing (204)", async () => {
    const tokens = {
      access_token: "valid",
      refresh_token: "ref",
      expiresAt: Date.now() + 3600000,
    };
    localStore["wortschatz-spotify-user1"] = JSON.stringify(tokens);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await getCurrentlyPlaying("user1");
    expect(result).toBeNull();
  });

  it("returns null when no tokens stored", async () => {
    const result = await getCurrentlyPlaying("unknown");
    expect(result).toBeNull();
  });

  it("joins multiple artists with comma", async () => {
    const multiArtist = {
      ...MOCK_CURRENTLY_PLAYING,
      item: {
        ...MOCK_CURRENTLY_PLAYING.item,
        artists: [{ name: "Nena" }, { name: "Kim Wilde" }],
      },
    };

    const tokens = {
      access_token: "valid",
      refresh_token: "ref",
      expiresAt: Date.now() + 3600000,
    };
    localStore["wortschatz-spotify-user1"] = JSON.stringify(tokens);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(multiArtist),
    });

    const result = await getCurrentlyPlaying("user1");
    expect(result.artist).toBe("Nena, Kim Wilde");
  });
});
