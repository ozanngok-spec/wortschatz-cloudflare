// ── Quiz logic (pure functions, easy to test) ─────────────────────────────────

/** Pick `count` random items from `arr`, excluding `exclude` */
export function pickRandom(arr, count, exclude = []) {
  const pool = arr.filter((w) => !exclude.includes(w));
  const result = [];
  const copy = [...pool];
  while (result.length < count && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(i, 1)[0]);
  }
  return result;
}

/** Shuffle an array (Fisher-Yates) */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Select the next word to quiz, prioritising:
 * 1. Words never reviewed (no lastReviewed)
 * 2. Words reviewed longest ago
 * 3. Words with lowest score
 * Excludes mastered words.
 */
export function selectNextWord(words, reviewMap) {
  const eligible = words.filter((w) => !w.mastered);
  if (eligible.length === 0) return null;

  return eligible.sort((a, b) => {
    const ra = reviewMap[a.id];
    const rb = reviewMap[b.id];
    // Never reviewed first
    if (!ra && rb) return -1;
    if (ra && !rb) return 1;
    if (!ra && !rb) return Math.random() - 0.5;
    // Oldest review first
    return ra.lastReviewed - rb.lastReviewed;
  })[0];
}

/** Build a German→English round */
export function buildDeToEn(word, allWords) {
  const wrong = pickRandom(allWords, 3, [word]).map((w) => w.translation);
  return {
    type: "de-en",
    prompt: word.word,
    correctAnswer: word.translation,
    options: shuffle([word.translation, ...wrong]),
    wordId: word.id,
  };
}

/** Build an English→German round */
export function buildEnToDe(word, allWords) {
  const wrong = pickRandom(allWords, 3, [word]).map((w) => w.word);
  return {
    type: "en-de",
    prompt: word.translation,
    correctAnswer: word.word,
    options: shuffle([word.word, ...wrong]),
    wordId: word.id,
  };
}

/** Build a fill-in-the-blank round from example sentences */
export function buildFillBlank(word) {
  const sentences = word.sentences || [];
  if (sentences.length === 0) return null;
  const s = sentences[Math.floor(Math.random() * sentences.length)];
  // Replace the word in the sentence with ___
  const regex = new RegExp(
    word.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "gi"
  );
  const blanked = s.german.replace(regex, "______");
  if (blanked === s.german) return null; // word not found in sentence
  return {
    type: "fill",
    prompt: blanked,
    hint: s.english,
    correctAnswer: word.word,
    wordId: word.id,
  };
}

/** Build a random round for a word */
export function buildRound(word, allWords) {
  // Need at least 4 words for multiple choice
  const hasEnoughForMC = allWords.filter((w) => !w.mastered).length >= 4;
  const hasSentences = (word.sentences || []).length > 0;

  const types = [];
  if (hasEnoughForMC) types.push("de-en", "en-de");
  if (hasSentences) types.push("fill");
  if (types.length === 0) return null;

  // Shuffle types so we try in random order, falling back if one fails
  const shuffled = shuffle(types);
  for (const type of shuffled) {
    let r = null;
    if (type === "de-en") r = buildDeToEn(word, allWords);
    else if (type === "en-de") r = buildEnToDe(word, allWords);
    else r = buildFillBlank(word);
    if (r) return r;
  }
  return null;
}
