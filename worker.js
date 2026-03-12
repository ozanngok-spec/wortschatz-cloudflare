const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const stripFences = (text) => text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

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
  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

async function handleClaude(req, env) {
  const { word } = await req.json();
  const prompt = `You are a German vocabulary assistant. For the German word or phrase "${word}", return a JSON object with:
- "word": the correct/canonical form of the word (fix spelling if needed, keep original if correct)
- "translation": English translation (concise)
- "type": one of "Nomen", "Verb", "Adjektiv", "Adverb", "Ausdruck"
- "level": CEFR level, one of "A1","A2","B1","B2","C1","C2"
- "explanation": a brief explanation in English (1-2 sentences)
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (request.method === "POST" && url.pathname === "/claude") {
      return handleClaude(request, env);
    }

    if (request.method === "POST" && url.pathname === "/pronounce") {
      return handlePronounce(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
