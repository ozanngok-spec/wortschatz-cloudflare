import { useState } from "react";
import { useTheme } from "../theme.js";

export function YouTubeAnalyzer({ words, onSaveWord }) {
  const th = useTheme();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [addingWord, setAddingWord] = useState(null);

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/youtube-vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.error === "no_captions") {
        setError(`Keine Untertitel verfügbar${data.title ? ` für "${data.title}"` : ""}. Das Video braucht deutsche Untertitel.`);
      } else if (data.error === "not_german") {
        setError(`Das Video ist auf ${data.language || "einer anderen Sprache"} — Analyse ist nur für deutsche Videos möglich.`);
      } else if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError("Fehler beim Analysieren: " + e.message);
    }
    setLoading(false);
  };

  const handleAdd = async (expr) => {
    if (addingWord || words.some(w => w.word.toLowerCase() === expr.word.toLowerCase())) return;
    setAddingWord(expr.word);
    const source = result?.title ? `🎬 ${result.title}` : "🎬 YouTube";
    try {
      await onSaveWord(expr.word, source);
    } catch (e) {
      console.error(e);
    }
    setAddingWord(null);
  };

  const reset = () => { setResult(null); setUrl(""); setError(""); };

  return (
    <div style={{ marginBottom: 8, background: th.bgCard, border: `1.5px solid ${th.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: th.isMobile ? "12px 14px" : "14px 18px" }}>
        <div style={{ fontSize: 10, color: th.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>
          🎬 YouTube-Analyse
        </div>

        {!result ? (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={url}
                onChange={e => { setUrl(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && !loading && analyze()}
                placeholder="YouTube-Link einfügen…"
                style={{ flex: 1, background: th.bgInset, border: `1px solid ${th.borderMid}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: th.text, outline: "none", fontFamily: "inherit" }}
              />
              <button
                onClick={analyze}
                disabled={loading || !url.trim()}
                style={{ background: loading ? th.bgCard : th.accent, color: loading ? th.textFaint : "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 12, fontFamily: "inherit", fontWeight: 600, cursor: loading ? "wait" : "pointer", whiteSpace: "nowrap", flexShrink: 0, boxShadow: loading ? "none" : `0 2px 6px ${th.accent}44` }}>
                {loading ? "⟳ Analysiere…" : "Analysieren"}
              </button>
            </div>
            {error && <p style={{ color: th.red, fontSize: 12, marginTop: 8, marginBottom: 0 }}>{error}</p>}
            <p style={{ fontSize: 11, color: th.textFaint, marginTop: 8, marginBottom: 0 }}>
              Das Video muss deutsche Untertitel haben (manuell oder automatisch generiert).
            </p>
          </>
        ) : (
          <>
            {/* Video title */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>🎬</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: th.text }}>{result.title}</div>
                <div style={{ fontSize: 11, color: th.textFaint }}>{result.expressions?.length || 0} Ausdrücke gefunden</div>
              </div>
            </div>

            {/* Expression list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(result.expressions || []).map((expr, i) => {
                const alreadyHave = words.some(w => w.word.toLowerCase() === expr.word.toLowerCase());
                const isAdding = addingWord === expr.word;
                return (
                  <div key={i} style={{ background: th.bgInset, border: `1px solid ${th.border}`, borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontFamily: "'Lora',Georgia,serif", fontWeight: 500, color: th.text }}>{expr.word}</span>
                          <span style={{ fontSize: 10, color: th.textFaint, padding: "1px 6px", background: th.bgCard, borderRadius: 4, border: `1px solid ${th.border}` }}>{expr.type}</span>
                        </div>
                        <div style={{ fontSize: 12, color: th.textMuted, marginTop: 2 }}>{expr.translation}</div>
                        {expr.context && (
                          <div style={{ fontSize: 11, color: th.textFaint, marginTop: 4, fontStyle: "italic", fontFamily: "'Lora',Georgia,serif" }}>
                            „{expr.context}"
                          </div>
                        )}
                        {expr.tags && expr.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                            {expr.tags.map(tag => (
                              <span key={tag} style={{ fontSize: 9, color: th.accent, background: th.accentBg, borderRadius: 10, padding: "0 6px" }}>#{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleAdd(expr)}
                        disabled={alreadyHave || isAdding}
                        style={{ background: alreadyHave ? th.bgInset : th.accentBg, color: alreadyHave ? th.textFaint : th.accent, border: `1px solid ${alreadyHave ? th.border : th.accent + "44"}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontFamily: "inherit", fontWeight: 500, cursor: alreadyHave ? "default" : "pointer", flexShrink: 0, opacity: alreadyHave ? 0.5 : 1 }}>
                        {alreadyHave ? "✓" : isAdding ? "…" : "+ Hinzufügen"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={reset} style={{ marginTop: 14, background: "transparent", border: `1px solid ${th.borderMid}`, borderRadius: 6, color: th.textMuted, fontSize: 11, fontFamily: "inherit", padding: "5px 12px", cursor: "pointer" }}>
              ← Neues Video
            </button>
          </>
        )}
      </div>
    </div>
  );
}
