export const TYPE_FILTERS = [
  { key: "all", label: "Alle" },
  { key: "nomen", label: "Nomen" },
  { key: "verb", label: "Verb" },
  { key: "ausdruck", label: "Ausdruck" },
  { key: "adjektiv", label: "Adjektiv" },
  { key: "adverb", label: "Adverb" },
  { key: "mastered", label: "✓ Gelernt" },
];

export const matchesTypeFilter = (word, filter) => {
  if (filter === "all") return true;
  if (filter === "mastered") return word.mastered;
  const t = (word.type || "").toLowerCase();
  if (filter === "nomen") return t.includes("nomen") || t.includes("noun");
  if (filter === "verb") return t.includes("verb");
  if (filter === "ausdruck")
    return (
      t.includes("ausdruck") ||
      t.includes("expression") ||
      t.includes("phrase") ||
      t.includes("redewendung")
    );
  if (filter === "adjektiv") return t.includes("adj");
  if (filter === "adverb") return t.includes("adverb");
  return true;
};

export const typeColor = (type, th) => {
  const t = (type || "").toLowerCase();
  if (th.isDark) {
    if (t.includes("nomen") || t.includes("noun"))
      return { bg: "#2D1F08", text: "#FBB040" };
    if (t.includes("verb")) return { bg: "#0C1E3A", text: "#60A5FA" };
    if (
      t.includes("ausdruck") ||
      t.includes("expression") ||
      t.includes("phrase") ||
      t.includes("redewendung")
    )
      return { bg: "#1E0D3C", text: "#A78BFA" };
    if (t.includes("adj")) return { bg: "#0A2D1A", text: "#34D399" };
    if (t.includes("adverb")) return { bg: "#3A0D18", text: "#FB7185" };
    return { bg: "#1A1A2A", text: "#94A3B8" };
  } else {
    if (t.includes("nomen") || t.includes("noun"))
      return { bg: "#FEF3C7", text: "#92400E" };
    if (t.includes("verb")) return { bg: "#DBEAFE", text: "#1D4ED8" };
    if (
      t.includes("ausdruck") ||
      t.includes("expression") ||
      t.includes("phrase") ||
      t.includes("redewendung")
    )
      return { bg: "#EDE9FE", text: "#5B21B6" };
    if (t.includes("adj")) return { bg: "#D1FAE5", text: "#065F46" };
    if (t.includes("adverb")) return { bg: "#FFE4E6", text: "#9F1239" };
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
