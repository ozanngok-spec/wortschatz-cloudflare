import { useState } from "react";
import { useTheme } from "../theme.js";

export function TagManager({ tags = [], onUpdate, uiLang }) {
  const th = useTheme();
  const s = (key, fallback) => uiLang?.strings?.[key] ?? fallback;
  const [input, setInput] = useState("");

  const addTag = () => {
    const t = input.trim().toLowerCase();
    if (!t || tags.includes(t)) { setInput(""); return; }
    onUpdate([...tags, t]);
    setInput("");
  };

  const removeTag = (tag) => onUpdate(tags.filter(t => t !== tag));

  return (
    <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${th.border}` }}>
      <div style={{ fontSize:9, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>{s("topicLabel", "Topics")}</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6 }}>
        {tags.map(tag => (
          <span key={tag} style={{ display:"inline-flex", alignItems:"center", gap:3, background:th.accentBg, color:th.accent, border:`1px solid ${th.accent}44`, borderRadius:20, padding:"2px 8px 2px 10px", fontSize:11, fontWeight:500 }}>
            #{tag}
            <button onClick={() => removeTag(tag)} style={{ background:"none", border:"none", color:th.accent, cursor:"pointer", padding:"0 0 0 2px", lineHeight:1, fontSize:14, opacity:0.7 }}>×</button>
          </span>
        ))}
        {tags.length === 0 && <span style={{ fontSize:11, color:th.textFaint, fontStyle:"italic" }}>{s("noTopics", "No topics yet")}</span>}
      </div>
      <div style={{ display:"flex", gap:6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder={s("addTopicPlaceholder", "Add topic…")}
          style={{ flex:1, background:th.bgInput, border:`1px solid ${th.borderMid}`, borderRadius:6, padding:"5px 10px", fontSize:11, color:th.text, outline:"none", fontFamily:"inherit" }}
        />
        <button onClick={addTag} style={{ background:"transparent", border:`1px solid ${th.borderMid}`, borderRadius:6, color:th.textMuted, fontSize:11, fontFamily:"inherit", padding:"5px 10px", cursor:"pointer" }}>+</button>
      </div>
    </div>
  );
}
