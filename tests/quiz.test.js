import { describe, it, expect } from "vitest";
import {
  pickRandom,
  shuffle,
  selectNextWord,
  buildDeToEn,
  buildEnToDe,
  buildFillBlank,
  buildRound,
} from "../src/lib/quiz.js";

// ── Mock vocabulary ───────────────────────────────────────────────────────────
const WORDS = [
  {
    id: "1",
    word: "der Hund",
    translation: "the dog",
    type: "Nomen",
    mastered: false,
    sentences: [
      { german: "Der Hund läuft schnell.", english: "The dog runs fast." },
    ],
  },
  {
    id: "2",
    word: "laufen",
    translation: "to run",
    type: "Verb",
    mastered: false,
    sentences: [
      { german: "Ich laufe jeden Tag.", english: "I run every day." },
    ],
  },
  {
    id: "3",
    word: "schnell",
    translation: "fast",
    type: "Adjektiv",
    mastered: false,
    sentences: [
      {
        german: "Das Auto ist schnell.",
        english: "The car is fast.",
      },
    ],
  },
  {
    id: "4",
    word: "die Katze",
    translation: "the cat",
    type: "Nomen",
    mastered: false,
    sentences: [
      {
        german: "Die Katze schläft gern.",
        english: "The cat likes to sleep.",
      },
    ],
  },
  {
    id: "5",
    word: "groß",
    translation: "big, tall",
    type: "Adjektiv",
    mastered: true,
    sentences: [
      {
        german: "Das Haus ist groß.",
        english: "The house is big.",
      },
    ],
  },
];

// ── pickRandom ────────────────────────────────────────────────────────────────
describe("pickRandom", () => {
  it("picks the requested number of items", () => {
    const result = pickRandom(WORDS, 3);
    expect(result).toHaveLength(3);
  });

  it("never exceeds available pool", () => {
    const result = pickRandom(WORDS, 100);
    expect(result).toHaveLength(WORDS.length);
  });

  it("excludes specified items", () => {
    const result = pickRandom(WORDS, 4, [WORDS[0]]);
    expect(result).not.toContain(WORDS[0]);
    expect(result).toHaveLength(4);
  });

  it("returns empty array from empty pool", () => {
    expect(pickRandom([], 3)).toHaveLength(0);
  });
});

// ── shuffle ───────────────────────────────────────────────────────────────────
describe("shuffle", () => {
  it("returns array of same length", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr)).toHaveLength(5);
  });

  it("contains all original elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    arr.forEach((item) => expect(result).toContain(item));
  });

  it("does not mutate original array", () => {
    const arr = [1, 2, 3];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});

// ── selectNextWord ────────────────────────────────────────────────────────────
describe("selectNextWord", () => {
  it("excludes mastered words", () => {
    const word = selectNextWord(WORDS, {});
    expect(word.mastered).toBe(false);
  });

  it("prefers unreviewed words", () => {
    const reviewMap = {
      1: { lastReviewed: Date.now(), correct: 1, total: 1 },
      2: { lastReviewed: Date.now(), correct: 1, total: 1 },
      3: { lastReviewed: Date.now(), correct: 1, total: 1 },
      // word 4 has no review — should be picked
    };
    const word = selectNextWord(WORDS, reviewMap);
    expect(word.id).toBe("4");
  });

  it("prefers oldest-reviewed words when all reviewed", () => {
    const now = Date.now();
    const reviewMap = {
      1: { lastReviewed: now - 100000, correct: 1, total: 1 }, // oldest
      2: { lastReviewed: now - 50000, correct: 1, total: 1 },
      3: { lastReviewed: now - 10000, correct: 1, total: 1 },
      4: { lastReviewed: now, correct: 1, total: 1 }, // newest
    };
    const word = selectNextWord(WORDS, reviewMap);
    expect(word.id).toBe("1");
  });

  it("returns null when all words are mastered", () => {
    const allMastered = WORDS.map((w) => ({ ...w, mastered: true }));
    expect(selectNextWord(allMastered, {})).toBeNull();
  });
});

// ── buildDeToEn ───────────────────────────────────────────────────────────────
describe("buildDeToEn", () => {
  it("creates a round with German prompt and 4 English options", () => {
    const round = buildDeToEn(WORDS[0], WORDS);
    expect(round.type).toBe("de-en");
    expect(round.prompt).toBe("der Hund");
    expect(round.correctAnswer).toBe("the dog");
    expect(round.options).toHaveLength(4);
    expect(round.options).toContain("the dog");
  });

  it("includes the correct answer in options", () => {
    for (let i = 0; i < 10; i++) {
      const round = buildDeToEn(WORDS[1], WORDS);
      expect(round.options).toContain(round.correctAnswer);
    }
  });

  it("has wordId set", () => {
    const round = buildDeToEn(WORDS[0], WORDS);
    expect(round.wordId).toBe("1");
  });
});

// ── buildEnToDe ───────────────────────────────────────────────────────────────
describe("buildEnToDe", () => {
  it("creates a round with English prompt and 4 German options", () => {
    const round = buildEnToDe(WORDS[0], WORDS);
    expect(round.type).toBe("en-de");
    expect(round.prompt).toBe("the dog");
    expect(round.correctAnswer).toBe("der Hund");
    expect(round.options).toHaveLength(4);
    expect(round.options).toContain("der Hund");
  });
});

// ── buildFillBlank ────────────────────────────────────────────────────────────
describe("buildFillBlank", () => {
  it("creates a round with blanked sentence", () => {
    const round = buildFillBlank(WORDS[0]);
    expect(round).not.toBeNull();
    expect(round.type).toBe("fill");
    expect(round.prompt).toContain("______");
    expect(round.prompt).not.toContain("der Hund");
    expect(round.correctAnswer).toBe("der Hund");
    expect(round.hint).toBeTruthy();
  });

  it("returns null for word without sentences", () => {
    const noSentences = { ...WORDS[0], sentences: [] };
    expect(buildFillBlank(noSentences)).toBeNull();
  });

  it("returns null when word not found in sentence", () => {
    const mismatch = {
      ...WORDS[0],
      word: "xyz_never_in_sentence",
      sentences: [{ german: "Hallo Welt", english: "Hello World" }],
    };
    expect(buildFillBlank(mismatch)).toBeNull();
  });
});

// ── buildRound ────────────────────────────────────────────────────────────────
describe("buildRound", () => {
  it("returns a valid round for eligible word", () => {
    const eligible = WORDS.filter((w) => !w.mastered);
    const round = buildRound(eligible[0], eligible);
    expect(round).not.toBeNull();
    expect(["de-en", "en-de", "fill"]).toContain(round.type);
    expect(round.correctAnswer).toBeTruthy();
  });

  it("returns null when not enough words for MC and no sentences", () => {
    const tiny = [
      {
        id: "x",
        word: "test",
        translation: "test",
        mastered: false,
        sentences: [],
      },
    ];
    expect(buildRound(tiny[0], tiny)).toBeNull();
  });

  it("always includes wordId", () => {
    const eligible = WORDS.filter((w) => !w.mastered);
    for (let i = 0; i < 20; i++) {
      const round = buildRound(eligible[0], eligible);
      if (round) expect(round.wordId).toBe(eligible[0].id);
    }
  });
});
