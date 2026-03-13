import { useState } from "react";
import { useTheme } from "../theme.js";
import { typeColor, levelColor } from "../lib/helpers.js";
import { SpeakBtn } from "./SpeakBtn.jsx";

export function WordOfTheDay({ wotd, loading, alreadyAdded, onAdd, adding, onRefresh }) {
  const th = useTheme();
  const [expanded, setExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wortschatz-wotd-expanded") ?? "true"); } catch(e) { return true; }
  });
  const toggleExpanded = () => {
    setExpanded(p => { const next = !p; localStorage.setItem("wortschatz-wotd-expanded", JSON.stringify(next)); return next; });
  };
  const today = new Date().toLocaleDateString("de-DE", { weekday:"long", day:"numeric", month:"long" });
  const borderColor = th.isDark ? th.accent + "38" : th.accent + "50";

  if (loading) return (
    <div style={{ background:th.accentBg, border:`1.5px solid ${borderColor}`, borderRadius:12, padding:"14px 18px", marginBottom:8 }}>
      <div style={{ fontSize:10, color:th.accent, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600 }}>✦ Wort des Tages</div>
      <div style={{ color:th.textFaint, fontSize:13, marginTop:6 }}>Wird geladen…</div>
    </div>
  );

  if (!wotd) return null;

  const tc = typeColor(wotd.type, th);

  return (
    <div style={{ background:th.accentBg, border:`1.5px solid ${borderColor}`, borderRadius:12, marginBottom:8, overflow:"hidden", boxShadow: th.isDark ? "none" : "0 1px 4px rgba(67,56,202,0.08)" }}>
      <div onClick={toggleExpanded} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:th.isMobile?"10px 14px":"13px 18px", cursor:"pointer" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:10, color:th.accent, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:700 }}>✦ Wort des Tages</span>
          <span style={{ fontSize:11, color:th.textFaint }}>{today}</span>
        </div>
        <span style={{ color:th.textFaint, fontSize:11, display:"inline-block", transform:expanded?"rotate(180deg)":"rotate(0)", transition:"transform 0.2s" }}>▾</span>
      </div>
      {expanded && (
        <div style={{ borderTop:`1px solid ${borderColor}`, padding:th.isMobile?"12px 14px 16px":"16px 18px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontSize:22, fontFamily:"'Lora',Georgia,serif", fontWeight:500, color:th.text }}>{wotd.word}</span>
            <SpeakBtn text={wotd.word} size={14} />
            <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:tc.bg, color:tc.text, letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:600 }}>{wotd.type}</span>
            {wotd.level && (() => { const lc = levelColor(wotd.level, th); return <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:lc.bg, color:lc.text, letterSpacing:"0.08em", fontWeight:700 }}>{wotd.level}</span>; })()}
          </div>
          {wotd.forms && <div style={{ fontSize:12, color:th.textWarm, marginBottom:4, fontFamily:"'Lora',Georgia,serif", fontStyle:"italic" }}>{wotd.forms}</div>}
          <div style={{ fontSize:14, color:th.textMuted, marginBottom:12 }}>{wotd.translation}</div>
          <p style={{ fontSize:13, color:th.textWarm, lineHeight:1.75, margin:"0 0 14px", fontFamily:"'Lora',Georgia,serif", fontStyle:"italic" }}>{wotd.explanation}</p>
          <div style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600, marginBottom:10 }}>Beispielsätze</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
            {(wotd.sentences||[]).map((s,i) => (
              <div key={i} style={{ borderLeft:`2px solid ${borderColor}`, paddingLeft:12 }}>
                <div style={{ fontSize:13, color:th.text, lineHeight:1.65, marginBottom:2, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  <span>
                    {s.german.split(new RegExp(`(${wotd.word})`,'gi')).map((part,j) =>
                      part.toLowerCase()===wotd.word.toLowerCase() ? <span key={j} style={{ color:th.accent }}>{part}</span> : part
                    )}
                  </span>
                  <SpeakBtn text={s.german} size={11} />
                </div>
                <div style={{ fontSize:11, color:th.textMuted }}>{s.english}</div>
              </div>
            ))}
          </div>
          {wotd.funFact && (
            <div style={{ background:th.accentBg, border:`1px solid ${borderColor}`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12, color:th.textGold, lineHeight:1.65 }}>
              💡 {wotd.funFact}
            </div>
          )}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <button onClick={onAdd} disabled={alreadyAdded || adding}
              style={{ background:alreadyAdded||adding?"transparent":th.accent, color:alreadyAdded?th.textFaint:adding?th.textMuted:"#fff", border:alreadyAdded||adding?`1px solid ${borderColor}`:"none", borderRadius:10, padding:"8px 18px", fontSize:12, fontFamily:"inherit", fontWeight:600, cursor:alreadyAdded||adding?"default":"pointer", transition:"all 0.2s", boxShadow:alreadyAdded||adding?"none":`0 2px 10px ${th.accent}44` }}>
              {alreadyAdded ? "✓ Bereits in deinem Wortschatz" : adding ? "Wird hinzugefügt…" : "+ Zum Wortschatz hinzufügen"}
            </button>
            <button onClick={onRefresh} disabled={loading}
              style={{ background:"transparent", border:`1px solid ${borderColor}`, borderRadius:10, padding:"8px 14px", fontSize:12, fontFamily:"inherit", color:loading?th.textFaint:th.accent, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:5, transition:"all 0.2s" }}>
              <span style={{ display:"inline-block", animation:loading?"spin 1s linear infinite":"none" }}>⟳</span>
              {loading ? "Wird geladen…" : "Neues Wort"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
