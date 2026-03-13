import { describe, it, expect, vi, beforeEach } from "vitest";
import { sbFetch, hashPin } from "../src/lib/supabase.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── sbFetch ───────────────────────────────────────────────────────────────────
describe("sbFetch", () => {
  it("sends request with correct Supabase headers", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([{ id: 1, word: "Hund" }])),
    });

    await sbFetch("/rest/v1/vocabulary?select=*");

    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain("supabase.co/rest/v1/vocabulary");
    expect(options.headers).toHaveProperty("apikey");
    expect(options.headers).toHaveProperty("Authorization");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers.Prefer).toBe("return=representation");
  });

  it("returns parsed JSON on success", async () => {
    const mockData = [{ id: 1, word: "der Hund", type: "Nomen" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockData)),
    });

    const result = await sbFetch("/rest/v1/vocabulary");
    expect(result).toEqual(mockData);
  });

  it("returns null for empty response body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });

    const result = await sbFetch("/rest/v1/vocabulary");
    expect(result).toBeNull();
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(sbFetch("/rest/v1/vocabulary")).rejects.toThrow("Supabase 401");
  });

  it("merges custom headers with defaults", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("[]"),
    });

    await sbFetch("/rest/v1/vocabulary", {
      method: "POST",
      headers: { "X-Custom": "value" },
    });

    const headers = fetch.mock.calls[0][1].headers;
    expect(headers["X-Custom"]).toBe("value");
    expect(headers.apikey).toBeDefined();
  });

  it("passes through method and body options", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ id: 99 })),
    });

    const body = JSON.stringify({ word: "laufen", type: "Verb" });
    await sbFetch("/rest/v1/vocabulary", { method: "POST", body });

    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(body);
  });
});

// ── hashPin ───────────────────────────────────────────────────────────────────
describe("hashPin", () => {
  it("returns a 64-character hex string", async () => {
    const hash = await hashPin("1234");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input gives same output", async () => {
    const h1 = await hashPin("secret");
    const h2 = await hashPin("secret");
    expect(h1).toBe(h2);
  });

  it("different PINs produce different hashes", async () => {
    const h1 = await hashPin("1111");
    const h2 = await hashPin("2222");
    expect(h1).not.toBe(h2);
  });

  it("includes salt (different from plain SHA-256 of PIN)", async () => {
    const hash = await hashPin("test");
    // If there was no salt, this would be SHA-256 of "test", which is:
    // 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    expect(hash).not.toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    );
  });
});
