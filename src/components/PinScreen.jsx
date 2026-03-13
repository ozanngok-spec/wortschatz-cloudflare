import { useState } from "react";
import { DARK, LIGHT } from "../theme.js";

export function PinScreen({ onEnter, darkMode, toggleDark }) {
  const th = darkMode ? DARK : LIGHT;
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const handle = () => {
    if (pin.trim().length < 4) { setError("Bitte mindestens 4 Zeichen eingeben."); return; }
    onEnter(pin.trim());
  };
  return (
    <div style={{ minHeight:"100vh", background:th.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',system-ui,sans-serif", padding:24, transition:"background 0.3s" }}>
      <div style={{ position:"absolute", top:20, right:24 }}>
        <button onClick={toggleDark} style={{ background:"transparent", border:`1px solid ${th.borderMid}`, borderRadius:20, padding:"4px 12px", fontSize:13, cursor:"pointer", color:th.textMuted, display:"flex", alignItems:"center", gap:6 }}>
          {darkMode ? "☀️" : "🌙"} <span style={{ fontSize:10 }}>{darkMode ? "Hell" : "Dunkel"}</span>
        </button>
      </div>
      <div style={{ textAlign:"center", maxWidth:380 }}>
        <div style={{ width:60, height:60, borderRadius:"50%", border:`1.5px solid ${th.accent}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 28px", fontSize:22, color:th.accent, fontFamily:"'Lora',Georgia,serif", fontStyle:"italic" }}>W</div>
        <h1 style={{ fontSize:32, fontWeight:600, color:th.text, margin:"0 0 6px", fontFamily:"'Lora',Georgia,serif", letterSpacing:"0.01em" }}>Wortschatz</h1>
        <p style={{ color:th.textMuted, fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", margin:"0 0 36px", fontWeight:500 }}>Dein persönlicher Wortschatz</p>
        <p style={{ color:th.textWarm, fontSize:14, lineHeight:1.8, marginBottom:28 }}>Gib deinen persönlichen PIN ein, um auf deinen Wortschatz zuzugreifen.<br/>Zum ersten Mal? Wähle einfach einen beliebigen PIN.</p>
        <input value={pin} onChange={e => { setPin(e.target.value); setError(""); }} onKeyDown={e => e.key==="Enter" && handle()} placeholder="PIN oder Passphrase…" type="password"
          style={{ width:"100%", background:th.bgInput, border:`1.5px solid ${th.borderMid}`, borderRadius:10, padding:"13px 18px", fontSize:16, color:th.text, outline:"none", fontFamily:"inherit", marginBottom:10, textAlign:"center", letterSpacing:"0.12em", boxShadow: th.isDark ? "none" : "0 1px 3px rgba(0,0,0,0.06)" }} />
        {error && <p style={{ color:th.red, fontSize:13, margin:"0 0 10px" }}>{error}</p>}
        <button onClick={handle} style={{ width:"100%", background:th.accent, color:"#fff", border:"none", borderRadius:10, padding:"14px", fontSize:13, fontFamily:"inherit", fontWeight:600, letterSpacing:"0.06em", cursor:"pointer", boxShadow:`0 2px 8px ${th.accent}44` }}>
          Meinen Wortschatz öffnen →
        </button>
        <p style={{ color:th.textFaint, fontSize:11, marginTop:16, lineHeight:1.6 }}>Dein PIN wird verschlüsselt gespeichert — niemals im Klartext.</p>
      </div>
    </div>
  );
}
