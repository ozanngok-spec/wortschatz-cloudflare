export const TYPE_FILTERS = [
  { key: "all",      label: "All" },
  { key: "nomen",    label: "Nouns" },
  { key: "verb",     label: "Verbs" },
  { key: "ausdruck", label: "Expressions" },
  { key: "adjektiv", label: "Adjectives" },
  { key: "adverb",   label: "Adverbs" },
  { key: "mastered", label: "✓ Mastered" },
];

export const matchesTypeFilter = (word, filter) => {
  if (filter === "all") return true;
  if (filter === "mastered") return word.mastered;
  // Normalize Turkish dotted/dotless-i so toLowerCase works predictably
  const t = (word.type || "").replace(/İ/g, "i").replace(/ı/g, "i").toLowerCase();
  if (filter === "nomen")
    return t.includes("nomen") || t.includes("noun") ||
           t.includes("sustantivo") ||    // es
           t.includes("nom") ||            // fr
           t.includes("sostantivo") ||     // it
           t.includes("substantivo") ||    // pt
           t.includes("名詞") || t.includes("名词") || // ja/zh
           t.includes("명사") ||           // ko
           t.includes("naamwoord") ||      // nl
           t.includes("isim") ||           // tr
           t.includes("benda");            // id
  if (filter === "verb")
    return t.includes("verb") ||
           t.includes("動詞") || t.includes("动词") || // ja/zh
           t.includes("동사") ||           // ko
           t.includes("werkwoord") ||      // nl
           t.includes("fiil") ||           // tr
           t.includes("kerja");            // id
  if (filter === "ausdruck")
    return t.includes("ausdruck") || t.includes("expression") || t.includes("phrase") || t.includes("redewendung") ||
           t.includes("expresi") ||        // es "expresión"
           t.includes("espressione") ||    // it
           t.includes("express") ||        // pt "expressão"
           t.includes("表現") || t.includes("표현") || t.includes("表达") || // ja/ko/zh
           t.includes("uitdrukking") ||    // nl
           t.includes("ifade") ||          // tr
           t.includes("ungkapan");         // id
  if (filter === "adjektiv")
    return t.includes("adj") ||
           t.includes("aggettiv") ||       // it "aggettivo"
           t.includes("bijvoeglijk") ||    // nl
           t.includes("sifat") ||          // tr "sıfat" (ı→i normalized) + id "kata sifat"
           t.includes("形容詞") || t.includes("形容词") || // ja/zh
           t.includes("형용사");           // ko
  if (filter === "adverb")
    return t.includes("adv") ||            // de/es/fr/pt (adverb/adverbio/adverbe/advérbio)
           t.includes("avverbio") ||       // it (starts with "avv" not "adv")
           t.includes("bijwoord") ||       // nl
           t.includes("zarf") ||           // tr
           t.includes("副詞") || t.includes("副词") || // ja/zh
           t.includes("부사") ||           // ko
           t.includes("keterangan");       // id
  return true;
};

export const typeColor = (type, th) => {
  // Normalize Turkish dotted/dotless-i so toLowerCase works predictably
  const t = (type || "").replace(/İ/g, "i").replace(/ı/g, "i").toLowerCase();
  const isNoun = t.includes("nomen") || t.includes("noun") ||
    t.includes("sustantivo") || t.includes("nom") || t.includes("sostantivo") ||
    t.includes("substantivo") || t.includes("名詞") || t.includes("名词") ||
    t.includes("명사") || t.includes("naamwoord") || t.includes("isim") ||
    t.includes("benda");
  const isVerb = t.includes("verb") ||
    t.includes("動詞") || t.includes("动词") || t.includes("동사") ||
    t.includes("werkwoord") || t.includes("fiil") || t.includes("kerja");
  const isExpr = t.includes("ausdruck") || t.includes("expression") ||
    t.includes("phrase") || t.includes("redewendung") || t.includes("expresi") ||
    t.includes("espressione") || t.includes("express") ||
    t.includes("表現") || t.includes("표현") || t.includes("表达") ||
    t.includes("uitdrukking") || t.includes("ifade") || t.includes("ungkapan");
  const isAdj = t.includes("adj") || t.includes("aggettiv") ||
    t.includes("bijvoeglijk") || t.includes("sifat") ||
    t.includes("形容詞") || t.includes("形容词") || t.includes("형용사");
  const isAdv = t.includes("adv") || t.includes("avverbio") ||
    t.includes("bijwoord") || t.includes("zarf") ||
    t.includes("副詞") || t.includes("副词") || t.includes("부사") ||
    t.includes("keterangan");
  if (th.isDark) {
    if (isNoun) return { bg: "#2D1F08", text: "#FBB040" };
    if (isVerb) return { bg: "#0C1E3A", text: "#60A5FA" };
    if (isExpr) return { bg: "#1E0D3C", text: "#A78BFA" };
    if (isAdj) return { bg: "#0A2D1A", text: "#34D399" };
    if (isAdv) return { bg: "#3A0D18", text: "#FB7185" };
    return { bg: "#1A1A2A", text: "#94A3B8" };
  } else {
    if (isNoun) return { bg: "#FEF3C7", text: "#92400E" };
    if (isVerb) return { bg: "#DBEAFE", text: "#1D4ED8" };
    if (isExpr) return { bg: "#EDE9FE", text: "#5B21B6" };
    if (isAdj) return { bg: "#D1FAE5", text: "#065F46" };
    if (isAdv) return { bg: "#FFE4E6", text: "#9F1239" };
    return { bg: "#F1F5F9", text: "#475569" };
  }
};

export const levelColor = (level, th) => {
  const l = (level || "").toUpperCase().trim();
  if (th && !th.isDark) {
    if (l === "A1") return { bg: "#DCFEE0", text: "#1A6B28" };
    if (l === "A2") return { bg: "#DCFEE8", text: "#1A6B40" };
    if (l === "B1") return { bg: "#DCF0FE", text: "#1448A0" };
    if (l === "B2") return { bg: "#DCE8FE", text: "#1438A0" };
    if (l === "C1") return { bg: "#FEF0DC", text: "#8A5014" };
    if (l === "C2") return { bg: "#FEDCF0", text: "#901460" };
    return { bg: "#F0F0F0", text: "#606060" };
  }
  if (l === "A1") return { bg: "#1A3A1A", text: "#7ACC7A" };
  if (l === "A2") return { bg: "#1A3020", text: "#6ABF6A" };
  if (l === "B1") return { bg: "#1A2E3A", text: "#7AB0E8" };
  if (l === "B2") return { bg: "#182538", text: "#5A9AD8" };
  if (l === "C1") return { bg: "#3A281A", text: "#E8A96E" };
  if (l === "C2") return { bg: "#3A1A2E", text: "#E87AB0" };
  return { bg: "#2A2A2A", text: "#888" };
};

/** Clean and normalise tags from AI response */
export const parseAutoTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean);
};

/** Build a source label for Spotify words */
export const buildSpotifySource = (trackName, artistName) => {
  if (!trackName) return null;
  return `🎵 ${trackName}${artistName ? " \u2013 " + artistName : ""}`;
};
