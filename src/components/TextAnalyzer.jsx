import { useState } from "react";
import { useTheme } from "../theme.js";

export function TextAnalyzer({ words }) {
  const th = useTheme();
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  const analyze = () => {
    if (!text.trim()) return;
    const vocabMap = new Map();
    for (const w of words) vocabMap.set(w.word.toLowerCase(), w);

    // Split text into German word tokens and separators
    const parts = [];
    const regex = /([A-Za-zÄÖÜäöüß]+)|([^A-Za-zÄÖÜäöüß]+)/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (m[1]) {
        const lower = m[1].toLowerCase();
        parts.push({ text: m[1], word: vocabMap.get(lower) || null });
      } else {
        parts.push({ text: m[2], word: null });
      }
    }

    // Deduplicate matched words by id
    const matched = [...new Map(
      parts.filter(p => p.word).map(p => [p.word.id, p.word])
    ).values()];

    setResult({ parts, matched });
  };

  const reset = () => { setResult(null); setText(""); };

  const foundBg   = th.isDark ? "#1A3A1A" : "#D1FAE5";
  const foundText = th.isDark ? "#7ACC7A" : "#065F46";
  const foundBorder = th.isDark ? "#2A5A2A" : "#A7F3D0";

  return (
    <div style={{ marginBottom:8, background:th.bgCard, border:`1.5px solid ${th.border}`, borderRadius:12, overflow:"hidden" }}>
      <div style={{ padding:th.isMobile?"12px 14px":"14px 18px" }}>
        <div style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600, marginBottom:12 }}>📝 Textanalyse</div>

        {!result ? (
          <>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Deutschen Text einfügen — Wörter aus deinem Wortschatz werden erkannt und hervorgehoben…"
              rows={5}
              style={{ width:"100%", background:th.bgInset, border:`1px solid ${th.borderMid}`, borderRadius:8, padding:"10px 12px", fontSize:13, color:th.text, outline:"none", fontFamily:"'Lora',Georgia,serif", lineHeight:1.75, resize:"vertical", boxSizing:"border-box" }}
            />
            <button
              onClick={analyze}
              disabled={!text.trim()}
              style={{ marginTop:8, background:text.trim()?th.accent:th.bgInset, color:text.trim()?"#fff":th.textFaint, border:"none", borderRadius:8, padding:"8px 18px", fontSize:12, fontFamily:"inherit", fontWeight:600, cursor:text.trim()?"pointer":"not-allowed", boxShadow:text.trim()?`0 2px 6px ${th.accent}44`:"none" }}>
              Analysieren
            </button>
          </>
        ) : (
          <>
            {/* Highlighted text */}
            <div style={{ background:th.bgInset, borderRadius:8, padding:"12px 14px", fontSize:14, lineHeight:2, marginBottom:14, fontFamily:"'Lora',Georgia,serif", color:th.text }}>
              {result.parts.map((p, i) =>
                p.word ? (
                  <span key={i} title={`${p.word.word} — ${p.word.translation}`}
                    style={{ background:foundBg, color:foundText, borderRadius:3, padding:"0 2px", cursor:"help", fontWeight:500 }}>
                    {p.text}
                  </span>
                ) : (
                  <span key={i}>{p.text}</span>
                )
              )}
            </div>

            {/* Matched word list */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>
                {result.matched.length > 0
                  ? `${result.matched.length} ${result.matched.length === 1 ? "Wort" : "Wörter"} aus deinem Wortschatz erkannt`
                  : "Keine Wörter aus deinem Wortschatz gefunden"}
              </div>
              {result.matched.length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {result.matched.map(w => (
                    <span key={w.id} title={w.translation}
                      style={{ background:foundBg, color:foundText, border:`1px solid ${foundBorder}`, borderRadius:6, padding:"2px 9px", fontSize:11, fontFamily:"'Lora',Georgia,serif", fontStyle:"italic" }}>
                      {w.word}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button onClick={reset} style={{ background:"transparent", border:`1px solid ${th.borderMid}`, borderRadius:6, color:th.textMuted, fontSize:11, fontFamily:"inherit", padding:"5px 12px", cursor:"pointer" }}>
              ← Neuer Text
            </button>
          </>
        )}
      </div>
    </div>
  );
}
