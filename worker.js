const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const stripFences = (text) =>
  text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

async function callClaude(apiKey, prompt, maxTokens = 1024) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok)
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

async function handleClaude(req, env) {
  const { word } = await req.json();
  const prompt = `You are a strict German vocabulary assistant and native-level editor. The user entered: "${word}".

Your first job is to determine the canonical correct form. Be STRICT — correct ANY of the following:
- Spelling mistakes
- Wrong or missing separable prefix in verbs or fixed expressions
- Wrong or missing preposition
- Wrong article or case
- Incomplete or malformed idioms/Redewendungen — always return the full, standard native form
- Non-standard word order in fixed expressions

Return a JSON object with:
- "word": the fully correct canonical form — if the user's input was wrong in ANY way (even subtly), return the corrected version here. Only keep the original if it is 100% correct.
- "translation": English translation (concise)
- "type": one of "Nomen", "Verb", "Adjektiv", "Adverb", "Ausdruck"
- "level": CEFR level, one of "A1","A2","B1","B2","C1","C2"
- "explanation": a brief explanation in German (1-2 sentences)
- "sentences": array of exactly 3 objects, each with "german" (example sentence using the word) and "english" (translation)
- "forms": grammatical forms string:
  - If Nomen: "der/die/das Word (plural)" e.g. "der Hund (die Hunde)"
  - If Verb: "3rd person present, past tense, perfect" e.g. "läuft, lief, ist gelaufen"
  - Otherwise: null

Return ONLY the raw JSON object, no markdown, no code fences.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handlePronounce(req, env) {
  const { word, transcript } = await req.json();
  const prompt = `You are a German pronunciation coach. The target word is "${word}". The learner said: "${transcript}".

Analyze the pronunciation and return a JSON object with:
- "score": integer 0-100 (how well they pronounced it)
- "feedback": a brief encouraging feedback message in German (1-2 sentences)
- "highlights": array of objects for each syllable/part of the word, each with:
  - "token": the syllable or character group
  - "quality": one of "gut" (good), "mittel" (ok), "schlecht" (needs work)

Split the word "${word}" into meaningful phonetic parts for the highlights array.
Return ONLY the raw JSON object, no markdown, no code fences.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleWotd(req, env) {
  const date = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${date}. Choose one interesting German word or expression for an advanced learner. It MUST be B2, C1, or C2 level — never below B2. It can be a single word or a multi-word expression (Redewendung, Sprichwort, idiom, or compound). Vary the type freely: sometimes a verb, sometimes an Ausdruck, sometimes a Nomen or Adjektiv. Prefer culturally rich, nuanced, or surprising choices that a native speaker would find natural but a learner might not know.

Return a JSON object with:
- "word": the word or expression
- "translation": English translation (concise)
- "type": one of "Nomen", "Verb", "Adjektiv", "Adverb", "Ausdruck"
- "level": CEFR level, one of "A1","A2","B1","B2","C1","C2"
- "explanation": a brief explanation in German (1-2 sentences)
- "sentences": array of exactly 2 objects, each with "german" (example sentence) and "english" (translation)
- "forms": grammatical forms:
  - If Nomen: "der/die/das Word (plural)" e.g. "der Hund (die Hunde)"
  - If Verb: "3rd person present, past tense, perfect" e.g. "läuft, lief, ist gelaufen"
  - Otherwise: null
- "funFact": one interesting cultural or linguistic note about the word, in German (1 sentence)

Return ONLY the raw JSON object, no markdown, no code fences.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt, 800);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleSpotifyVocab(req, env) {
  const { title, artist, lyrics } = await req.json();

  const prompt = `You are a German vocabulary assistant. A user is learning German and is listening to a song.

Song: "${title}" by ${artist}
${
  lyrics
    ? `\nLyrics (excerpt):\n${lyrics}`
    : "\n(No lyrics available — determine the language from the song title and artist name.)"
}

Your task:
1. Determine the language of the song.${
    lyrics
      ? " Use the lyrics to determine this."
      : " Infer from the artist and title."
  }
2. If the song is NOT in German, return: {"language": "<detected language in German, e.g. Englisch, Spanisch, Indonesisch>", "isGerman": false, "words": []}
3. If the song IS in German${
    lyrics ? " and lyrics are available" : ""
  }, extract 5-10 useful vocabulary words or expressions that would be valuable for a B1-C1 German learner. Pick interesting, non-trivial words — skip basic words like ich, und, ist, das, ein.

For each word return:
- "word": canonical dictionary form (infinitive for verbs, nominative singular with article for nouns)
- "translation": concise English translation
- "type": one of "Nomen", "Verb", "Adjektiv", "Adverb", "Ausdruck"

Return: {"language": "Deutsch", "isGerman": true, "words": [...]}

Return ONLY the raw JSON object, no markdown, no code fences.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt, 800);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (request.method === "GET" && url.pathname === "/wotd") {
      return handleWotd(request, env);
    }

    if (request.method === "POST" && url.pathname === "/claude") {
      return handleClaude(request, env);
    }

    if (request.method === "POST" && url.pathname === "/pronounce") {
      return handlePronounce(request, env);
    }

    if (request.method === "POST" && url.pathname === "/spotify-vocab") {
      return handleSpotifyVocab(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
