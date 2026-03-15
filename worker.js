const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const stripFences = (text) => {
  let s = text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  // If still not starting with { or [, try to extract JSON object from the text
  if (s[0] !== "{" && s[0] !== "[") {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end > start) s = s.slice(start, end + 1);
  }
  return s;
};

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

// Language config for worker (mirrors src/lib/languages.js)
const LANG_CONFIG = {
  de: { name: "German", types: ["Nomen","Verb","Adjektiv","Adverb","Ausdruck"], formsInstructions: `- If Nomen: "der/die/das Word (plural)" e.g. "der Hund (die Hunde)"\n- If Verb: "3rd person present, past tense, perfect" e.g. "läuft, lief, ist gelaufen"\n- Otherwise: null` },
  es: { name: "Spanish", types: ["Sustantivo","Verbo","Adjetivo","Adverbio","Expresión"], formsInstructions: `- If Sustantivo: "el/la Word (plural)" e.g. "el perro (los perros)"\n- If Verbo: "yo, tú, él present tense" e.g. "corro, corres, corre"\n- Otherwise: null` },
  fr: { name: "French", types: ["Nom","Verbe","Adjectif","Adverbe","Expression"], formsInstructions: `- If Nom: "le/la Word (plural)" e.g. "le chien (les chiens)"\n- If Verbe: "je, tu, il present tense" e.g. "cours, cours, court"\n- Otherwise: null` },
  it: { name: "Italian", types: ["Sostantivo","Verbo","Aggettivo","Avverbio","Espressione"], formsInstructions: `- If Sostantivo: "il/la Word (plural)" e.g. "il cane (i cani)"\n- If Verbo: "io, tu, lui present tense" e.g. "corro, corri, corre"\n- Otherwise: null` },
  pt: { name: "Portuguese", types: ["Substantivo","Verbo","Adjetivo","Advérbio","Expressão"], formsInstructions: `- If Substantivo: "o/a Word (plural)" e.g. "o cão (os cães)"\n- If Verbo: "eu, tu, ele present tense" e.g. "corro, corres, corre"\n- Otherwise: null` },
  ja: { name: "Japanese", types: ["名詞","動詞","形容詞","副詞","表現"], formsInstructions: `- If 動詞: dictionary form, て-form, ます-form e.g. "食べる, 食べて, 食べます"\n- If 名詞: include reading in parentheses e.g. "食べ物 (たべもの)"\n- Otherwise: null` },
  zh: { name: "Chinese", types: ["名词","动词","形容词","副词","表达"], formsInstructions: `- Include pinyin in parentheses e.g. "狗 (gǒu)"\n- Otherwise: null` },
  ko: { name: "Korean", types: ["명사","동사","형용사","부사","표현"], formsInstructions: `- If 동사/형용사: dictionary form and polite present e.g. "먹다, 먹어요"\n- Otherwise: null` },
  nl: { name: "Dutch", types: ["Zelfstandig naamwoord","Werkwoord","Bijvoeglijk naamwoord","Bijwoord","Uitdrukking"], formsInstructions: `- If Zelfstandig naamwoord: "de/het Word (plural)" e.g. "de hond (de honden)"\n- If Werkwoord: "infinitive, past tense, past participle" e.g. "lopen, liep, gelopen"\n- Otherwise: null` },
  tr: { name: "Turkish", types: ["İsim","Fiil","Sıfat","Zarf","İfade"], formsInstructions: `- If Fiil: infinitive and present tense e.g. "koşmak, koşuyor"\n- Otherwise: null` },
  id: { name: "Indonesian", types: ["Kata Benda","Kata Kerja","Kata Sifat","Kata Keterangan","Ungkapan"], formsInstructions: `- If Kata Kerja: base form and me- prefix form e.g. "makan, memakan"\n- If Kata Benda: include plural reduplication if common e.g. "buku (buku-buku)"\n- Otherwise: null` },
};

function getLang(code) {
  return LANG_CONFIG[code] || LANG_CONFIG["de"];
}

async function handleClaude(req, env) {
  const { word, targetLanguage = "de", targetLevel = "B1" } = await req.json();
  const lang = getLang(targetLanguage);
  const types = lang.types.join('", "');
  const prompt = `You are a strict ${lang.name} vocabulary assistant and native-level editor. The learner is at ${targetLevel} level. The user entered: "${word}".

Your first job is to determine the canonical correct form. Be STRICT — correct ANY of the following:
- Spelling mistakes
- Wrong or missing separable prefix in verbs or fixed expressions
- Wrong or missing preposition
- Wrong article or case
- Incomplete or malformed idioms — always return the full, standard native form
- Non-standard word order in fixed expressions

Return a JSON object with:
- "word": the fully correct canonical form — if the user's input was wrong in ANY way (even subtly), return the corrected version here. Only keep the original if it is 100% correct.
- "translation": English translation (concise)
- "type": one of "${types}"
- "level": CEFR level based on word frequency and register — NOT the complexity of the concept it expresses:
  • A1: ~500 most essential words. Immediate survival/daily use: greetings, numbers, family, basic verbs (eat/go/be/have), colors, days, body parts.
  • A2: Common everyday words (~500–2000 frequency). Simple familiar topics: shopping, travel basics, feelings, routines, food, home.
  • B1: Frequent but requiring deliberate study (~2000–5000). Work, events, opinions, some abstract ideas. A tourist wouldn't know it but a 1-year learner would.
  • B2: Less frequent, nuanced or register-sensitive (~5000–10000). Abstract topics, idiomatic usage, multiple meanings, collocations.
  • C1: Low-frequency, sophisticated — idiomatic, literary, formal, or domain-specific. Near-native range needed to know it naturally.
  • C2: Rare, archaic, highly specialized, or extremely subtle in nuance. Even educated native speakers use it infrequently.
  Base the level on how often a native speaker uses this exact word/expression, not on how hard the idea is.
- "explanation": a brief explanation in ${lang.name} pitched at ${targetLevel} level (1-2 sentences — use simpler language for A1/A2, richer detail for C1/C2)
- "sentences": array of exactly 3 objects, each with "target" (example sentence in ${lang.name} using the word, complexity appropriate for ${targetLevel}) and "english" (translation)
- "forms": grammatical forms string:
${lang.formsInstructions}
- "tags": array of 1-2 lowercase topic/theme tags in ${lang.name} that categorise the word (e.g. ["travel"], ["food","culture"], ["work"], ["feelings"], ["nature"], ["everyday"]). Pick the most fitting topics — use short, common single words.

Return ONLY the raw JSON object, no markdown, no code fences.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handlePronounce(req, env) {
  const { word, transcript, targetLanguage = "de" } = await req.json();
  const lang = getLang(targetLanguage);
  const prompt = `You are a ${lang.name} pronunciation coach. The target word is "${word}". The learner said: "${transcript}".

Analyze the pronunciation and return a JSON object with:
- "score": integer 0-100 (how well they pronounced it)
- "feedback": a brief encouraging feedback message in ${lang.name} (1-2 sentences)
- "highlights": array of objects for each syllable/part of the word, each with:
  - "token": the syllable or character group
  - "quality": one of "good", "ok", "needs-work"

Split the word "${word}" into meaningful phonetic parts for the highlights array.
Return ONLY the raw JSON object, no markdown, no code fences.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleWotd(req, env) {
  const url = new URL(req.url);
  const targetLanguage = url.searchParams.get("lang") || "de";
  const targetLevel = url.searchParams.get("level") || "B1";
  const lang = getLang(targetLanguage);
  const types = lang.types.join('", "');
  const date = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${date}. Choose one interesting ${lang.name} word or expression for a ${targetLevel} learner. It should be at or just above ${targetLevel} level to challenge the learner. It can be a single word or a multi-word expression (idiom, proverb, or compound). Vary the type freely. Prefer culturally rich, nuanced, or surprising choices that a native speaker would find natural but a learner might not know.

Return a JSON object with:
- "word": the word or expression
- "translation": English translation (concise)
- "type": one of "${types}"
- "level": CEFR level based on word frequency and register — NOT the complexity of the concept it expresses:
  • A1: ~500 most essential words. Immediate survival/daily use: greetings, numbers, family, basic verbs (eat/go/be/have), colors, days, body parts.
  • A2: Common everyday words (~500–2000 frequency). Simple familiar topics: shopping, travel basics, feelings, routines, food, home.
  • B1: Frequent but requiring deliberate study (~2000–5000). Work, events, opinions, some abstract ideas. A tourist wouldn't know it but a 1-year learner would.
  • B2: Less frequent, nuanced or register-sensitive (~5000–10000). Abstract topics, idiomatic usage, multiple meanings, collocations.
  • C1: Low-frequency, sophisticated — idiomatic, literary, formal, or domain-specific. Near-native range needed to know it naturally.
  • C2: Rare, archaic, highly specialized, or extremely subtle in nuance. Even educated native speakers use it infrequently.
  Base the level on how often a native speaker uses this exact word/expression, not on how hard the idea is.
- "explanation": a brief explanation in ${lang.name} pitched at ${targetLevel} level (1-2 sentences)
- "sentences": array of exactly 2 objects, each with "target" (example sentence in ${lang.name}, complexity appropriate for ${targetLevel}) and "english" (translation)
- "forms": grammatical forms:
${lang.formsInstructions}
- "tags": array of 1-2 lowercase topic/theme tags in ${lang.name} (e.g. ["culture"], ["work","everyday"])
- "funFact": one interesting cultural or linguistic note about the word, in ${lang.name} (1 sentence)

Return ONLY the raw JSON object, no markdown, no code fences.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt, 800);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleSpotifyVocab(req, env) {
  const { title, artist, lyrics, targetLanguage = "de" } = await req.json();
  const lang = getLang(targetLanguage);
  const types = lang.types.join('", "');

  const prompt = `You are a vocabulary assistant. A user is learning ${lang.name} and is listening to a song.

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
2. If the song is instrumental, classical, or has no vocals/text, return: {"language": "Instrumental", "isTargetLanguage": false, "words": []}
3. If the song is NOT in ${lang.name}, return: {"language": "<detected language in English>", "isTargetLanguage": false, "words": []}
4. If the song IS in ${lang.name}${
    lyrics ? " and lyrics are available" : ""
  }, extract 5-10 useful vocabulary words or expressions that would be valuable for a B1-C1 learner. Pick interesting, non-trivial words — skip the most basic common words.

For each word return:
- "word": canonical dictionary form
- "translation": concise English translation
- "type": one of "${types}"

Return: {"language": "${lang.name}", "isTargetLanguage": true, "words": [...]}

Return ONLY the raw JSON object, no markdown, no code fences.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt, 800);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleYoutubeVocab(req, env) {
  const { url, targetLanguage = "de" } = await req.json();
  const lang = getLang(targetLanguage);
  const types = lang.types.join('", "');
  if (!url) return new Response(JSON.stringify({ error: "URL required" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });

  // Extract video ID
  const idMatch = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  if (!idMatch) return new Response(JSON.stringify({ error: "Invalid YouTube URL" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
  const videoId = idMatch[1];

  // Fetch the YouTube page to extract caption tracks
  let pageHtml;
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept-Language": `${targetLanguage},en;q=0.5` }
    });
    pageHtml = await pageRes.text();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Could not fetch YouTube page" }), { status: 502, headers: { "Content-Type": "application/json", ...CORS } });
  }

  // Extract video title
  const titleMatch = pageHtml.match(/<title>([^<]*)<\/title>/);
  const videoTitle = titleMatch ? titleMatch[1].replace(/ - YouTube$/, "").trim() : "Unknown";

  // Parse caption tracks from ytInitialPlayerResponse
  const captionMatch = pageHtml.match(/"captions":\s*({.*?}),\s*"videoDetails"/);
  if (!captionMatch) {
    return new Response(JSON.stringify({ error: "no_captions", title: videoTitle }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
  }

  let tracks;
  try {
    const captionData = JSON.parse(captionMatch[1]);
    tracks = captionData?.playerCaptionsTracklistRenderer?.captionTracks || [];
  } catch {
    return new Response(JSON.stringify({ error: "no_captions", title: videoTitle }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
  }

  if (tracks.length === 0) {
    return new Response(JSON.stringify({ error: "no_captions", title: videoTitle }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
  }

  // Prefer target language captions (manual > auto), then any
  const targetManu = tracks.find(t => t.languageCode === targetLanguage && t.kind !== "asr");
  const targetAuto = tracks.find(t => t.languageCode === targetLanguage);
  const anyTrack = tracks[0];
  const chosen = targetManu || targetAuto || anyTrack;
  const isTargetLanguage = chosen.languageCode === targetLanguage;
  const captionLang = chosen.name?.simpleText || chosen.languageCode;

  // Fetch caption XML
  let captionText;
  try {
    const capRes = await fetch(chosen.baseUrl);
    const xml = await capRes.text();
    captionText = xml
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/\s+/g, " ").trim();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Could not fetch captions" }), { status: 502, headers: { "Content-Type": "application/json", ...CORS } });
  }

  if (!isTargetLanguage) {
    return new Response(JSON.stringify({ error: "not_target_language", title: videoTitle, language: captionLang, targetLanguage: lang.name }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
  }

  // Send to Claude for analysis
  const transcript = captionText.slice(0, 4000);
  const prompt = `You are a ${lang.name} language tutor. A learner is watching a YouTube video titled "${videoTitle}".

Here is the transcript (auto-captions, may have minor errors):
${transcript}

Extract 8-15 of the most useful and interesting ${lang.name} expressions, phrases, or vocabulary from this transcript that would help a B1-C2 learner. Focus on:
- Idiomatic expressions and phrases
- Useful collocations
- Advanced or interesting vocabulary (B2+)
- Common spoken patterns

Skip trivial/basic words.

For each item return:
- "word": the expression or word in canonical form
- "translation": concise English translation
- "type": one of "${types}"
- "context": a short quote from the transcript where this appeared (max 15 words)
- "tags": array of 1-2 lowercase topic tags in ${lang.name}

You MUST return ONLY a raw JSON object: {"expressions": [...]}
Do NOT include any explanation, commentary, markdown, or code fences — just the JSON.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt, 1500);
  let json;
  try {
    json = JSON.parse(stripFences(text));
  } catch (e) {
    console.error("YouTube Claude parse error:", text.slice(0, 200));
    return new Response(JSON.stringify({ error: "AI returned invalid JSON. Please try again.", title: videoTitle }), {
      status: 502, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  return new Response(JSON.stringify({ ...json, title: videoTitle }), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleTravelPhrases(req, env) {
  const { category, targetLanguage = "de" } = await req.json();
  const lang = getLang(targetLanguage);

  const categoryDescriptions = {
    airport:     "airport and flights (check-in, boarding, immigration, customs, lost luggage)",
    hotel:       "hotel (check-in, checkout, room issues, requesting amenities, complaints)",
    restaurant:  "restaurant and cafes (ordering, menu questions, dietary needs, paying the bill)",
    transport:   "transport (taxi, rideshare, bus, metro, train, asking about fare and stops)",
    emergency:   "emergency situations (medical help, lost wallet or phone, police, urgent help)",
    shopping:    "shopping (asking prices, trying sizes, payment methods, refunds, market haggling)",
    directions:  "asking for and understanding directions, finding your way around",
    social:      "social situations (greetings, meeting people, small talk, polite phrases)",
  };

  const desc = categoryDescriptions[category] || category;

  const prompt = `Generate 8 essential travel phrases a tourist would need for: ${desc}

Target language: ${lang.name}

Return ONLY a raw JSON object with no markdown:
{
  "phrases": [
    {
      "target": "phrase in ${lang.name} (natural, what a native would actually say)",
      "romanization": "romanization if non-Latin script, otherwise null",
      "english": "English meaning",
      "note": "very short usage note or null"
    }
  ]
}`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt, 700);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleTravelSituation(req, env) {
  const { situation, targetLanguage = "de" } = await req.json();
  const lang = getLang(targetLanguage);

  const prompt = `You are a travel language assistant. A traveler describes their situation:
"${situation}"

They need to communicate in ${lang.name}. Return ONLY a raw JSON object with no markdown:
{
  "phrases": [
    {
      "target": "key phrase to say in ${lang.name}",
      "romanization": "romanization if non-Latin script, otherwise null",
      "english": "English translation",
      "when": "when to use this (1 short phrase)"
    }
  ],
  "tips": ["practical tip"],
  "responses": [
    {
      "target": "typical response you might hear in ${lang.name}",
      "english": "what it means"
    }
  ]
}
Include 3-5 phrases, 1-2 tips, 2-3 typical responses a local might give.`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt, 800);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleTravelRoleplay(req, env) {
  const { scenario, messages = [], targetLanguage = "de", isOpening = false } = await req.json();
  const lang = getLang(targetLanguage);

  const historyText = messages.length > 0
    ? messages.map(m => `${m.role === "user" ? "Traveler" : "Local"}: ${m.content}`).join("\n")
    : "";

  const prompt = `You are playing a native ${lang.name} speaker in this travel scenario: "${scenario}".
Respond naturally and concisely as a local would.${isOpening ? " Start the conversation with a natural opening line (e.g. greeting the traveler)." : ""}

${historyText ? `Conversation so far:\n${historyText}\n\nNow respond as the Local.` : "Begin the conversation."}

Return ONLY a raw JSON object with no markdown:
{
  "reply": "your response in ${lang.name}",
  "romanization": "romanization if non-Latin script, otherwise null",
  "translation": "English translation of your reply",
  "feedback": {
    "score": 0-100 rating of the traveler's last message (null if no traveler message yet),
    "correction": "corrected version of traveler's last message if there was an error, otherwise null",
    "tip": "one helpful grammar or vocabulary tip, or null"
  }
}`;

  const text = await callClaude(env.ANTHROPIC_API_KEY, prompt, 500);
  const json = JSON.parse(stripFences(text));
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleTravelTts(req, env) {
  const { text } = await req.json();

  if (!env.ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: "ElevenLabs API key not configured" }), {
      status: 503, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  // Charlotte — natural multilingual voice (requires Starter plan+)
  const voiceId = "XB0fDUnXU5powFXDhCwa";

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: "TTS failed", detail: err }), {
      status: 502, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const audio = await res.arrayBuffer();
  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg", "Access-Control-Allow-Origin": "*" },
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

    if (request.method === "POST" && url.pathname === "/youtube-vocab") {
      return handleYoutubeVocab(request, env);
    }

    if (request.method === "POST" && url.pathname === "/travel-phrases") {
      return handleTravelPhrases(request, env);
    }

    if (request.method === "POST" && url.pathname === "/travel-situation") {
      return handleTravelSituation(request, env);
    }

    if (request.method === "POST" && url.pathname === "/travel-roleplay") {
      return handleTravelRoleplay(request, env);
    }

    if (request.method === "POST" && url.pathname === "/travel-tts") {
      return handleTravelTts(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
