import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";


const SUPABASE_URL = "https://yhdwabrbsyeexllrbdni.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZHdhYnJic3llZXhsbHJiZG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTMyMjAsImV4cCI6MjA4ODg4OTIyMH0.cs0IYZ6am2LTNfSL9-ugdSECQTSmV7rzUwTKRcKOMVc";

const sbFetch = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type":"application/json", "apikey":SUPABASE_ANON_KEY, "Authorization":`Bearer ${SUPABASE_ANON_KEY}`, "Prefer":"return=representation", ...(options.headers||{}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin + "wortschatz-salt"));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK = {
  isDark:      true,
  bg:          "#111110",
  bgCard:      "#1C1B18",
  bgInput:     "#161513",
  bgInset:     "#111110",
  border:      "#272521",
  borderMid:   "#363129",
  borderActive:"#463F35",
  text:        "#EDE7DB",
  textMuted:   "#7A7268",
  textFaint:   "#4A4640",
  textDim:     "#343028",
  textGold:    "#9D96F5",
  textWarm:    "#A08868",
  accent:      "#7C75F0",
  accentBg:    "#1A1928",
  filterBg:    "#161513",
  filterText:  "#5A5448",
  pillBg:      "#222018",
  red:         "#F87171",
  green:       "#4ADE80",
};
const LIGHT = {
  isDark:      false,
  bg:          "#F7F3EC",
  bgCard:      "#FFFFFF",
  bgInput:     "#FFFFFF",
  bgInset:     "#EEE9DF",
  border:      "#E4DDD1",
  borderMid:   "#C8BEB0",
  borderActive:"#B0A594",
  text:        "#1C1810",
  textMuted:   "#6E6456",
  textFaint:   "#A09080",
  textDim:     "#C4BAA8",
  textGold:    "#4338CA",
  textWarm:    "#7A5C38",
  accent:      "#4338CA",
  accentBg:    "#EEEEFF",
  filterBg:    "#FFFFFF",
  filterText:  "#6E6456",
  pillBg:      "#EDE8DF",
  red:         "#BE123C",
  green:       "#15803D",
};

const ThemeCtx = createContext(DARK);
const useTheme = () => useContext(ThemeCtx);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ── AI ────────────────────────────────────────────────────────────────────────
async function fetchExampleSentences(word) {
  const response = await fetch("/claude", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ word }) });
  if (!response.ok) throw new Error(`Proxy error ${response.status}: ${await response.text()}`);
  return await response.json();
}

async function fetchPronunciationFeedback(targetWord, transcript) {
  const response = await fetch("/pronounce", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ word:targetWord, transcript }) });
  if (!response.ok) throw new Error(`Proxy error ${response.status}`);
  return await response.json();
}

async function fetchWordOfTheDay() {
  const response = await fetch("/wotd");
  if (!response.ok) throw new Error(`WOTD error ${response.status}`);
  return await response.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_FILTERS = [
  { key:"all", label:"Alle" }, { key:"nomen", label:"Nomen" }, { key:"verb", label:"Verb" },
  { key:"ausdruck", label:"Ausdruck" }, { key:"adjektiv", label:"Adjektiv" },
  { key:"adverb", label:"Adverb" }, { key:"mastered", label:"✓ Gelernt" },
];

const matchesTypeFilter = (word, filter) => {
  if (filter === "all") return true;
  if (filter === "mastered") return word.mastered;
  const t = (word.type || "").toLowerCase();
  if (filter === "nomen")    return t.includes("nomen") || t.includes("noun");
  if (filter === "verb")     return t.includes("verb");
  if (filter === "ausdruck") return t.includes("ausdruck") || t.includes("expression") || t.includes("phrase") || t.includes("redewendung");
  if (filter === "adjektiv") return t.includes("adj");
  if (filter === "adverb")   return t.includes("adverb");
  return true;
};

const typeColor = (type, th) => {
  const t = (type || "").toLowerCase();
  if (th.isDark) {
    if (t.includes("nomen") || t.includes("noun")) return { bg:"#2D1F08", text:"#FBB040" };
    if (t.includes("verb")) return { bg:"#0C1E3A", text:"#60A5FA" };
    if (t.includes("ausdruck") || t.includes("expression") || t.includes("phrase") || t.includes("redewendung")) return { bg:"#1E0D3C", text:"#A78BFA" };
    if (t.includes("adj")) return { bg:"#0A2D1A", text:"#34D399" };
    if (t.includes("adverb")) return { bg:"#3A0D18", text:"#FB7185" };
    return { bg:"#1A1A2A", text:"#94A3B8" };
  } else {
    if (t.includes("nomen") || t.includes("noun")) return { bg:"#FEF3C7", text:"#92400E" };
    if (t.includes("verb")) return { bg:"#DBEAFE", text:"#1D4ED8" };
    if (t.includes("ausdruck") || t.includes("expression") || t.includes("phrase") || t.includes("redewendung")) return { bg:"#EDE9FE", text:"#5B21B6" };
    if (t.includes("adj")) return { bg:"#D1FAE5", text:"#065F46" };
    if (t.includes("adverb")) return { bg:"#FFE4E6", text:"#9F1239" };
    return { bg:"#F1F5F9", text:"#475569" };
  }
};

const levelColor = (level, th) => {
  const l = (level || "").toUpperCase().trim();
  if (th && !th.isDark) {
    if (l === "A1") return { bg:"#DCFEE0", text:"#1A6B28" };
    if (l === "A2") return { bg:"#DCFEE8", text:"#1A6B40" };
    if (l === "B1") return { bg:"#DCF0FE", text:"#1448A0" };
    if (l === "B2") return { bg:"#DCE8FE", text:"#1438A0" };
    if (l === "C1") return { bg:"#FEF0DC", text:"#8A5014" };
    if (l === "C2") return { bg:"#FEDCF0", text:"#901460" };
    return { bg:"#F0F0F0", text:"#606060" };
  }
  if (l === "A1") return { bg:"#1A3A1A", text:"#7ACC7A" };
  if (l === "A2") return { bg:"#1A3020", text:"#6ABF6A" };
  if (l === "B1") return { bg:"#1A2E3A", text:"#7AB0E8" };
  if (l === "B2") return { bg:"#182538", text:"#5A9AD8" };
  if (l === "C1") return { bg:"#3A281A", text:"#E8A96E" };
  if (l === "C2") return { bg:"#3A1A2E", text:"#E87AB0" };
  return { bg:"#2A2A2A", text:"#888" };
};

// ── Speak Button ──────────────────────────────────────────────────────────────
function SpeakBtn({ text, size = 13 }) {
  const [speaking, setSpeaking] = useState(false);
  const handleSpeak = (e) => {
    e.stopPropagation(); setSpeaking(true);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE"; u.rate = 0.9;
    u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  return (
    <button onClick={handleSpeak} title="Anhören" style={{ background:"transparent", border:"none", cursor:"pointer", padding:"2px 4px", fontSize:size, opacity:speaking?1:0.5, transition:"opacity 0.2s", lineHeight:1 }}>
      {speaking ? "🔊" : "🔈"}
    </button>
  );
}

// ── Highlighted Word ──────────────────────────────────────────────────────────
function HighlightedWord({ word, highlights }) {
  if (!highlights || highlights.length === 0) return <span style={{ fontSize:22, fontStyle:"italic" }}>{word}</span>;
  const colorMap = { gut:"#6aaa6a", mittel:"#c8a96e", schlecht:"#c87070" };
  return (
    <span style={{ fontSize:22, fontStyle:"italic", letterSpacing:"0.02em" }}>
      {highlights.map((h, i) => (
        <span key={i} style={{ color:colorMap[h.quality]||"inherit", borderBottom:`2px solid ${colorMap[h.quality]||"transparent"}`, paddingBottom:2, transition:"color 0.4s" }}>{h.token}</span>
      ))}
    </span>
  );
}

// ── Pronunciation Practice ────────────────────────────────────────────────────
function PronunciationPractice({ word }) {
  const th = useTheme();
  const [state, setState] = useState("idle");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(null);
  const [highlights, setHighlights] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [volume, setVolume] = useState(0);
  const recognitionRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const hasResultRef = useRef(false);

  const stopAudio = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch(e) {} }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setVolume(0);
  };

  const startVolumeMonitor = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext(); audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setVolume(Math.min(100, data.reduce((a,b)=>a+b,0)/data.length*2.5));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch(e) {}
  };

  const start = async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setFeedback("Spracherkennung nicht unterstützt. Bitte Chrome verwenden."); setState("done"); return; }
    hasResultRef.current = false;
    setTranscript(""); setHighlights(null); setScore(null);
    const r = new SR();
    r.lang = "de-DE"; r.interimResults = true; r.maxAlternatives = 1;
    recognitionRef.current = r;
    r.onresult = async (e) => {
      const heard = Array.from(e.results).map(r=>r[0].transcript).join("");
      if (e.results[e.results.length-1].isFinal) {
        hasResultRef.current = true; setTranscript(heard); stopAudio(); setState("processing");
        try {
          const result = await fetchPronunciationFeedback(word, heard);
          setFeedback(result.feedback); setScore(result.score); setHighlights(result.highlights);
        } catch(e) { setFeedback("Fehler bei der Analyse. Bitte erneut versuchen."); }
        setState("done");
      } else { setTranscript(heard); }
    };
    r.onerror = (e) => {
      stopAudio();
      if (e.error==="no-speech") setFeedback("Kein Ton erkannt. Bitte lauter sprechen.");
      else if (e.error==="not-allowed") setFeedback("Mikrofonzugriff verweigert.");
      else setFeedback("Fehler bei der Aufnahme. Bitte erneut versuchen.");
      setState("done");
    };
    r.onend = () => { stopAudio(); if (!hasResultRef.current) { setFeedback("Kein Ton erkannt. Bitte lauter sprechen."); setState("done"); } };
    r.start(); setState("listening");
    await startVolumeMonitor();
    setTimeout(() => { if (!hasResultRef.current) { try { recognitionRef.current?.stop(); } catch(e) {} } }, 8000);
  };

  const stop = () => { try { recognitionRef.current?.stop(); } catch(e) {} stopAudio(); if (!hasResultRef.current) setState("idle"); };
  const reset = () => { setState("idle"); setFeedback(""); setTranscript(""); setScore(null); setHighlights(null); setVolume(0); };

  const bars = Array.from({ length:8 }, (_,i) => ({ h:6+i*3, active:volume>(i/8)*100 }));
  const scoreColor = score===null?th.textFaint:score>=75?th.green:score>=45?th.accent:th.red;
  const scoreLabel = score===null?"":score>=75?"Sehr gut!":score>=45?"Gut, weiter üben!":"Weiter üben!";

  return (
    <div style={{ marginTop:14, padding:"14px 16px", background:th.bgInset, borderRadius:6, border:`1px solid ${th.border}` }}>
      <div style={{ fontSize:9, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:12 }}>Aussprache üben</div>
      <div style={{ marginBottom:14, padding:"10px 14px", background:th.bgCard, borderRadius:6, border:`1px solid ${th.border}`, textAlign:"center" }}>
        <span style={{ color: state==="done" ? th.text : state==="listening" ? th.accent : th.textMuted, transition:"color 0.3s" }}>
          {state==="done" && highlights ? <HighlightedWord word={word} highlights={highlights} /> : <span style={{ fontSize:22, fontStyle:"italic" }}>{word}</span>}
        </span>
        {state==="done" && score!==null && <div style={{ marginTop:6, fontSize:11, color:scoreColor }}>{scoreLabel} ({score}/100)</div>}
        {state==="done" && highlights && (
          <div style={{ marginTop:8, display:"flex", gap:12, justifyContent:"center", fontSize:10 }}>
            <span style={{ color:th.green }}>● gut</span>
            <span style={{ color:th.accent }}>● mittel</span>
            <span style={{ color:th.red }}>● schlecht</span>
          </div>
        )}
      </div>
      {state==="idle" && (
        <button onClick={start} style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:th.textMuted, fontSize:11, fontFamily:"inherit", padding:"5px 12px", cursor:"pointer" }}>
          🎤 Jetzt sprechen
        </button>
      )}
      {state==="listening" && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:28 }}>
              {bars.map((b,i) => <div key={i} style={{ width:5, height:b.h, borderRadius:2, background:b.active?(volume>60?th.accent:"#7a9e6e"):th.border, transition:"background 0.08s" }} />)}
            </div>
            <span style={{ fontSize:12, color:th.textMuted }}>Aufnahme läuft…</span>
            <button onClick={stop} style={{ marginLeft:"auto", background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:th.red, fontSize:10, fontFamily:"inherit", padding:"3px 8px", cursor:"pointer" }}>⏹ Stop</button>
          </div>
          {transcript && <div style={{ fontSize:12, color:th.textMuted, fontStyle:"italic" }}>Gehört: <span style={{ color:th.textWarm }}>{transcript}</span></div>}
          <div style={{ fontSize:10, color:th.textDim, marginTop:4 }}>Sprich laut und deutlich — bis zu 8 Sekunden</div>
        </div>
      )}
      {state==="processing" && <div style={{ color:th.textMuted, fontSize:12 }}>Analysiere Aussprache…</div>}
      {state==="done" && (
        <div>
          {transcript && <div style={{ fontSize:11, color:th.textFaint, marginBottom:8 }}>Gehört: <em style={{ color:th.textMuted }}>„{transcript}"</em></div>}
          <div style={{ fontSize:13, color:th.textWarm, lineHeight:1.7, marginBottom:10 }}>{feedback}</div>
          <button onClick={reset} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:th.textMuted, fontSize:10, fontFamily:"inherit", padding:"3px 10px", cursor:"pointer" }}>⟳ Nochmal versuchen</button>
        </div>
      )}
    </div>
  );
}


// ── Word of the Day ──────────────────────────────────────────────────────────
function WordOfTheDay({ wotd, loading, alreadyAdded, onAdd, adding, onRefresh }) {
  const th = useTheme();
  const [expanded, setExpanded] = useState(true);
  const today = new Date().toLocaleDateString("de-DE", { weekday:"long", day:"numeric", month:"long" });
  const borderColor = th.isDark ? "#2E2850" : "#C4BBF5";

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
      <div onClick={() => setExpanded(p => !p)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:th.isMobile?"10px 14px":"13px 18px", cursor:"pointer" }}>
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
            <div style={{ background:th.isDark?"rgba(124,117,240,0.1)":"rgba(67,56,202,0.06)", border:`1px solid ${borderColor}`, borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12, color:th.isDark?"#A78BFA":"#5B21B6", lineHeight:1.65 }}>
              💡 {wotd.funFact}
            </div>
          )}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <button onClick={onAdd} disabled={alreadyAdded || adding}
              style={{ background:alreadyAdded||adding?"transparent":th.accent, color:alreadyAdded?th.textFaint:adding?th.textMuted:"#fff", border:alreadyAdded||adding?`1px solid ${borderColor}`:"none", borderRadius:8, padding:"8px 18px", fontSize:12, fontFamily:"inherit", fontWeight:600, cursor:alreadyAdded||adding?"default":"pointer", transition:"all 0.2s" }}>
              {alreadyAdded ? "✓ Bereits in deinem Wortschatz" : adding ? "Wird hinzugefügt…" : "+ Zum Wortschatz hinzufügen"}
            </button>
            <button onClick={onRefresh} disabled={loading}
              style={{ background:"transparent", border:`1px solid ${borderColor}`, borderRadius:8, padding:"8px 14px", fontSize:12, fontFamily:"inherit", color:loading?th.textFaint:th.isDark?"#A78BFA":"#5B21B6", cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:5, transition:"all 0.2s" }}>
              <span style={{ display:"inline-block", animation:loading?"spin 1s linear infinite":"none" }}>⟳</span>
              {loading ? "Wird geladen…" : "Neues Wort"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PIN Screen ────────────────────────────────────────────────────────────────
function PinScreen({ onEnter, darkMode, toggleDark }) {
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

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wortschatz-darkmode") ?? "false"); } catch(e) { return false; }
  });
  const isMobile = useIsMobile();
  const th = { ...(darkMode ? DARK : LIGHT), isMobile };

  const [userId, setUserId] = useState(null);
  const [words, setWords] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [storageLoading, setStorageLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [retryingId, setRetryingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [wotd, setWotd] = useState(null);
  const [wotdLoading, setWotdLoading] = useState(true);
  const [wotdAdding, setWotdAdding] = useState(false);
  const [wotdDbId, setWotdDbId] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("wortschatz-uid");
    if (stored) setUserId(stored);
    setStorageLoading(false);
  }, []);

  const handlePin = async (pin) => {
    const hashed = await hashPin(pin);
    sessionStorage.setItem("wortschatz-uid", hashed);
    setUserId(hashed);
  };
  const handleLogout = () => { sessionStorage.removeItem("wortschatz-uid"); setUserId(null); setWords([]); };

  const loadWords = useCallback(async () => {
    if (!userId) return;
    setDbLoading(true);
    try {
      const data = await sbFetch(`/rest/v1/vocabulary?user_id=eq.${userId}&select=*&order=added_at.desc`);
      setWords((data||[]).map(w => ({ id:w.id, word:w.word, translation:w.translation, type:w.type, level:w.level||'', explanation:w.explanation, sentences:w.sentences, forms:w.forms||null, mastered:w.mastered, addedAt:w.added_at })));
    } catch(e) { console.error(e); }
    setDbLoading(false);
  }, [userId]);

  useEffect(() => { if (userId) loadWords(); }, [userId, loadWords]);

  useEffect(() => {
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);
    setWotdLoading(true);
    sbFetch(`/rest/v1/word_of_the_day?user_id=eq.${userId}&date=eq.${today}&select=*`)
      .then(rows => {
        if (rows && rows.length > 0) {
          setWotd(rows[0].data); setWotdDbId(rows[0].id); setWotdLoading(false);
        } else {
          fetchWordOfTheDay()
            .then(data => {
              setWotd(data);
              return sbFetch("/rest/v1/word_of_the_day", { method:"POST", body:JSON.stringify({ user_id:userId, date:today, data }) })
                .then(res => { if (res && res.length > 0) setWotdDbId(res[0].id); });
            })
            .finally(() => setWotdLoading(false));
        }
      })
      .catch(e => { console.error("WOTD:", e); setWotdLoading(false); });
  }, [userId]);

  const save = async (updated) => {}; // unused in deploy, Supabase handles persistence
  const toggleDark = () => {
    const next = !darkMode; setDarkMode(next);
    try { localStorage.setItem("wortschatz-darkmode", JSON.stringify(next)); } catch(e) {}
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Spracherkennung nicht unterstützt. Bitte Chrome verwenden."); return; }
    const r = new SR(); r.lang = "de-DE"; r.interimResults = false; r.maxAlternatives = 1;
    recognitionRef.current = r;
    r.onresult = (e) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false); r.onend = () => setIsListening(false);
    r.start(); setIsListening(true);
  };
  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); };

  const handleAdd = async () => {
    const trimmed = input.trim(); if (!trimmed) return;
    setLoading(true); setError(""); setSuggestion(null);
    try {
      const ai = await fetchExampleSentences(trimmed);
      const finalWord = ai.word || trimmed;
      if (words.find(w => w.word.toLowerCase() === finalWord.toLowerCase())) { setError("Dieses Wort ist bereits in deiner Liste."); setLoading(false); return; }
      if (finalWord.toLowerCase() !== trimmed.toLowerCase()) { setSuggestion({ original:trimmed, corrected:finalWord, ai }); setLoading(false); return; }
      await saveWord(finalWord, ai);
    } catch(e) { setError("Fehler: " + e.message); }
    setLoading(false);
  };

  const saveWord = async (finalWord, ai) => {
    const result = await sbFetch("/rest/v1/vocabulary", { method:"POST", body:JSON.stringify({ user_id:userId, word:finalWord, translation:ai.translation, type:ai.type, level:ai.level||"", explanation:ai.explanation, sentences:ai.sentences, forms:ai.forms||null, mastered:false }) });
    const inserted = Array.isArray(result) ? result[0] : result;
    setWords(prev => [{ id:inserted.id, word:inserted.word, translation:inserted.translation, type:inserted.type, level:inserted.level||'', explanation:inserted.explanation, sentences:inserted.sentences, forms:ai.forms||inserted.forms||null, mastered:inserted.mastered, addedAt:inserted.added_at }, ...prev]);
    setInput(""); setExpandedId(inserted.id); setSuggestion(null);
  };

  const acceptSuggestion = () => { if (suggestion) saveWord(suggestion.corrected, suggestion.ai); };
  const rejectSuggestion = () => { if (suggestion) saveWord(suggestion.original, suggestion.ai); };

  const handleRetry = async (w) => {
    setRetryingId(w.id);
    try {
      const ai = await fetchExampleSentences(w.word);
      await sbFetch(`/rest/v1/vocabulary?id=eq.${w.id}`, { method:"PATCH", body:JSON.stringify({ translation:ai.translation, type:ai.type, explanation:ai.explanation, sentences:ai.sentences, forms:ai.forms||null }) });
      setWords(prev => prev.map(x => x.id===w.id ? { ...x, translation:ai.translation, type:ai.type, explanation:ai.explanation, sentences:ai.sentences, forms:ai.forms||null } : x));
    } catch(e) { console.error(e); }
    setRetryingId(null);
  };

  const handleDelete = async (id) => {
    setDeleteConfirmId(null);
    await sbFetch(`/rest/v1/vocabulary?id=eq.${id}`, { method:"DELETE" });
    setWords(prev => prev.filter(w => w.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleAddWotd = async () => {
    if (!wotd || wotdAdding) return;
    setWotdAdding(true);
    try { await saveWord(wotd.word, wotd); } catch(e) { console.error(e); }
    setWotdAdding(false);
  };

  const handleRefreshWotd = async () => {
    if (wotdLoading) return;
    const today = new Date().toISOString().slice(0, 10);
    setWotdLoading(true);
    try {
      const data = await fetchWordOfTheDay();
      if (wotdDbId) {
        await sbFetch(`/rest/v1/word_of_the_day?id=eq.${wotdDbId}`, { method:"PATCH", body:JSON.stringify({ data }) });
      } else {
        const res = await sbFetch("/rest/v1/word_of_the_day", { method:"POST", body:JSON.stringify({ user_id:userId, date:today, data }) });
        if (res && res.length > 0) setWotdDbId(res[0].id);
      }
      setWotd(data);
    } catch(e) { console.error("WOTD refresh:", e); }
    setWotdLoading(false);
  };

  const toggleMastered = async (id, current) => {
    await sbFetch(`/rest/v1/vocabulary?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ mastered:!current }) });
    setWords(prev => prev.map(w => w.id===id ? { ...w, mastered:!current } : w));
  };

  const filteredWords = words.filter(w => matchesTypeFilter(w, filter));
  const countFor = (key) => key==="all" ? words.length : words.filter(w => matchesTypeFilter(w, key)).length;

  const popup = { background:th.bgCard, border:`1px solid ${th.borderActive}`, borderRadius:10, padding:"28px 32px", maxWidth:360, width:"90%", textAlign:"center", fontFamily:"'Palatino Linotype',Palatino,serif" };
  const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 };

  if (storageLoading) return <div style={{ minHeight:"100vh", background:th.bg, display:"flex", alignItems:"center", justifyContent:"center", color:th.textFaint, fontFamily:"'Inter',system-ui,sans-serif", fontSize:13 }}>Laden…</div>;
  if (!userId) return <PinScreen onEnter={handlePin} darkMode={darkMode} toggleDark={toggleDark} />;

  return (
    <ThemeCtx.Provider value={th}>
    <div style={{ minHeight:"100vh", background:th.bg, fontFamily:"'Inter',system-ui,sans-serif", color:th.text, transition:"background 0.3s, color 0.3s" }}>

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${th.border}`, padding:th.isMobile?"14px 16px 12px":"18px 36px 14px", background:th.bg, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <div style={{ maxWidth:740, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
              <h1 style={{ fontSize:20, fontWeight:600, color:th.text, margin:0, fontFamily:"'Lora',Georgia,serif" }}>Wortschatz</h1>
              <span style={{ fontSize:9, color:th.textFaint, letterSpacing:"0.16em", textTransform:"uppercase", fontWeight:500 }}>C1</span>
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button onClick={handleLogout} style={{ background:"transparent", border:`1px solid ${th.border}`, borderRadius:6, color:th.textFaint, fontSize:11, fontFamily:"inherit", fontWeight:500, padding:"5px 10px", cursor:"pointer" }}>{th.isMobile ? "🔒" : "Sperren"}</button>
            <button onClick={toggleDark} title={darkMode ? "Heller Modus" : "Dunkler Modus"}
              style={{ background:th.bgCard, border:`1px solid ${th.border}`, borderRadius:6, padding:"5px 10px", fontSize:13, cursor:"pointer", color:th.textMuted, display:"flex", alignItems:"center", gap:4, transition:"all 0.2s" }}>
              {darkMode ? "☀️" : "🌙"} {!th.isMobile && <span style={{ fontSize:11, fontWeight:500 }}>{darkMode ? "Hell" : "Dunkel"}</span>}
            </button>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={input} onChange={e => { setInput(e.target.value); setError(""); setSuggestion(null); }}
              onKeyDown={e => e.key==="Enter" && !loading && handleAdd()}
              placeholder={th.isMobile ? "Wort eingeben…" : "Deutsches Wort oder Ausdruck eingeben…"}
              style={{ flex:1, background:th.bgInput, border:`1.5px solid ${th.borderMid}`, borderRadius:10, padding:"11px 16px", fontSize:th.isMobile?16:15, color:th.text, outline:"none", fontFamily:"inherit", boxShadow: th.isDark ? "none" : "0 1px 3px rgba(0,0,0,0.06)" }} />
            <button onClick={isListening ? stopListening : startListening}
              style={{ background:isListening?th.red:th.bgInput, border:`1.5px solid ${isListening?th.red:th.borderMid}`, borderRadius:10, padding:"11px 14px", fontSize:16, cursor:"pointer", transition:"all 0.2s", lineHeight:1 }}>
              {isListening ? "⏹" : "🎤"}
            </button>
            <button onClick={handleAdd} disabled={loading||!input.trim()}
              style={{ background:loading?th.bgCard:th.accent, color:loading?th.textFaint:"#fff", border:"none", borderRadius:10, padding:th.isMobile?"11px 14px":"11px 22px", fontSize:12, fontFamily:"inherit", fontWeight:600, letterSpacing:"0.04em", cursor:loading?"not-allowed":"pointer", whiteSpace:"nowrap", boxShadow: loading ? "none" : `0 2px 8px ${th.accent}44` }}>
              {loading ? "…" : th.isMobile ? "+" : "Hinzufügen"}
            </button>
          </div>
          {isListening && <p style={{ color:th.accent, fontSize:12, marginTop:8, marginBottom:0 }}>🎤 Höre zu… jetzt auf Deutsch sprechen</p>}
          {error && <p style={{ color:th.red, fontSize:12, marginTop:8, marginBottom:0 }}>{error}</p>}
        </div>
      </div>

      {/* Stats + Filters */}
      <div style={{ maxWidth:740, margin:"0 auto", padding:th.isMobile?"10px 16px 0":"14px 36px 0" }}>
        <div style={{ fontSize:11, color:th.textFaint, letterSpacing:"0.04em", marginBottom:12 }}>
          {words.length} Wörter &nbsp;·&nbsp; <span style={{ color:th.accent, fontWeight:500 }}>{words.filter(w=>w.mastered).length} gelernt</span> &nbsp;·&nbsp; {words.filter(w=>!w.mastered).length} in Bearbeitung
        </div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {TYPE_FILTERS.map(({ key, label }) => {
            const count = countFor(key); const active = filter===key;
            return (
              <button key={key} onClick={() => setFilter(key)} style={{ display:"flex", alignItems:"center", gap:5, background:active?th.accent:th.bgCard, color:active?"#fff":th.textMuted, border:`1.5px solid ${active?th.accent:th.border}`, borderRadius:8, padding:th.isMobile?"4px 8px":"5px 12px", fontSize:th.isMobile?10:11, fontFamily:"inherit", fontWeight:active?600:400, cursor:"pointer", transition:"all 0.15s" }}>
                {label}
                <span style={{ fontSize:10, fontWeight:500, background:active?"rgba(255,255,255,0.2)":th.pillBg, borderRadius:6, padding:"0 5px" }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Word of the Day */}
      <div style={{ maxWidth:740, margin:"0 auto", padding:th.isMobile?"8px 16px 0":"12px 36px 0" }}>
        <WordOfTheDay
          wotd={wotd}
          loading={wotdLoading}
          alreadyAdded={!!(wotd && words.some(w => w.word.toLowerCase() === wotd.word.toLowerCase()))}
          onAdd={handleAddWotd}
          adding={wotdAdding}
          onRefresh={handleRefreshWotd}
        />
      </div>

      {/* Word List */}
      <div style={{ maxWidth:740, margin:"0 auto", padding:th.isMobile?"8px 16px 48px":"12px 36px 60px" }}>
        {dbLoading && <div style={{ textAlign:"center", padding:"40px 0", color:th.textFaint, fontSize:13 }}>Lade deinen Wortschatz…</div>}
        {!dbLoading && filteredWords.length===0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:th.textDim }}>
            <div style={{ fontSize:34, marginBottom:10 }}>📖</div>
            <p style={{ fontSize:13 }}>{words.length===0 ? "Füge dein erstes Wort hinzu" : "Keine Wörter in dieser Kategorie"}</p>
          </div>
        )}
        {!dbLoading && filteredWords.map(w => {
          const tc = typeColor(w.type, th); const isRetrying = retryingId===w.id;
          return (
            <div key={w.id} style={{ background:th.bgCard, border:`1.5px solid ${expandedId===w.id?th.borderActive:th.border}`, borderRadius:12, marginBottom:8, overflow:"hidden", opacity:w.mastered?0.45:1, transition:"all 0.2s", boxShadow: th.isDark ? "none" : "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div onClick={() => setExpandedId(expandedId===w.id?null:w.id)} style={{ display:"flex", alignItems:"center", padding:th.isMobile?"12px 14px":"14px 18px", cursor:"pointer", gap:th.isMobile?8:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:17, fontFamily:"'Lora',Georgia,serif", fontWeight:500, color:w.mastered?th.textFaint:th.text, textDecoration:w.mastered?"line-through":"none" }}>{w.word}</span>
                    <SpeakBtn text={w.word} size={13} />
                    <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:tc.bg, color:tc.text, letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:600 }}>{w.type}</span>
                    {w.level && (() => { const lc = levelColor(w.level, th); return <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:lc.bg, color:lc.text, letterSpacing:"0.08em", fontWeight:700 }}>{w.level}</span>; })()}
                  </div>
                  <div style={{ fontSize:13, color:th.textMuted, marginTop:3 }}>{w.translation}</div>
                  {w.forms && <div style={{ fontSize:12, color:th.textWarm, marginTop:2, fontFamily:"'Lora',Georgia,serif", fontStyle:"italic" }}>{w.forms}</div>}
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                  <button onClick={e => { e.stopPropagation(); toggleMastered(w.id, w.mastered); }} style={{ background:w.mastered?th.accent+"22":"transparent", border:`1.5px solid ${w.mastered?th.accent:th.border}`, color:w.mastered?th.accent:th.textFaint, borderRadius:6, padding:"3px 8px", fontSize:10, fontFamily:"inherit", fontWeight:500, letterSpacing:"0.04em", cursor:"pointer" }}>
                    {w.mastered ? "✓" : th.isMobile ? "✓?" : "Gelernt?"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(w.id); }}
                    onMouseEnter={e=>e.target.style.color=th.red} onMouseLeave={e=>e.target.style.color=th.textFaint}
                    style={{ background:"transparent", border:"none", color:th.textFaint, fontSize:18, cursor:"pointer", padding:"2px 4px", lineHeight:1, transition:"color 0.15s" }}>×</button>
                  <span style={{ color:th.textFaint, fontSize:11, display:"inline-block", transform:expandedId===w.id?"rotate(180deg)":"rotate(0)", transition:"transform 0.2s" }}>▾</span>
                </div>
              </div>
              {expandedId===w.id && (
                <div style={{ borderTop:`1px solid ${th.border}`, padding:th.isMobile?"12px 14px 16px":"16px 18px 20px" }}>
                  <p style={{ fontSize:13, color:th.textWarm, lineHeight:1.75, margin:"0 0 12px", fontFamily:"'Lora',Georgia,serif", fontStyle:"italic" }}>{w.explanation}</p>
                  <button onClick={() => handleRetry(w)} disabled={isRetrying} style={{ background:"transparent", border:`1px solid ${th.border}`, borderRadius:6, color:isRetrying?th.textFaint:th.textMuted, fontSize:11, fontFamily:"inherit", fontWeight:500, padding:"4px 12px", cursor:isRetrying?"not-allowed":"pointer", marginBottom:18 }}>
                    {isRetrying ? "⟳ Aktualisiere…" : "⟳ Erneut generieren"}
                  </button>
                  <div style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600, marginBottom:12 }}>Beispielsätze</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                    {(w.sentences||[]).map((s,i) => (
                      <div key={i} style={{ borderLeft:`2px solid ${th.borderMid}`, paddingLeft:13 }}>
                        <div style={{ fontSize:14, color:th.text, lineHeight:1.65, marginBottom:3, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          <span>
                            {s.german.split(new RegExp(`(${w.word})`,"gi")).map((part,j) =>
                              part.toLowerCase()===w.word.toLowerCase() ? <span key={j} style={{ color:th.accent }}>{part}</span> : part
                            )}
                          </span>
                          <SpeakBtn text={s.german} size={12} />
                        </div>
                        <div style={{ fontSize:12, color:th.textMuted, lineHeight:1.5 }}>{s.english}</div>
                      </div>
                    ))}
                  </div>
                  <PronunciationPractice word={w.word} />
                  <div style={{ fontSize:9, color:th.textDim, marginTop:14 }}>
                    Hinzugefügt am {new Date(w.addedAt).toLocaleDateString("de-DE",{day:"numeric",month:"short",year:"numeric"})}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Meintest du? */}
      {suggestion && (
        <div style={overlay} onClick={() => setSuggestion(null)}>
          <div onClick={e=>e.stopPropagation()} style={popup}>
            <div style={{ fontSize:22, marginBottom:12 }}>✏️</div>
            <p style={{ color:th.textMuted, fontSize:13, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:16 }}>Meintest du...?</p>
            <p style={{ color:th.text, fontSize:20, fontStyle:"italic", marginBottom:6 }}>{suggestion.corrected}</p>
            <p style={{ color:th.textFaint, fontSize:12, marginBottom:24 }}>statt <span style={{ textDecoration:"line-through", color:th.textDim }}>{suggestion.original}</span></p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={rejectSuggestion} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:6, color:th.textMuted, fontSize:12, fontFamily:"inherit", padding:"9px 18px", cursor:"pointer" }}>Nein, so behalten</button>
              <button onClick={acceptSuggestion} style={{ background:th.accent, border:"none", borderRadius:6, color:"#0a0908", fontSize:12, fontFamily:"inherit", fontWeight:"bold", padding:"9px 18px", cursor:"pointer" }}>Ja, korrigieren</button>
            </div>
          </div>
        </div>
      )}

      {/* Löschen */}
      {deleteConfirmId && (
        <div style={overlay} onClick={() => setDeleteConfirmId(null)}>
          <div onClick={e=>e.stopPropagation()} style={popup}>
            <div style={{ fontSize:22, marginBottom:12 }}>🗑️</div>
            <p style={{ color:th.text, fontSize:15, marginBottom:6 }}><strong>{words.find(w=>w.id===deleteConfirmId)?.word}</strong></p>
            <p style={{ color:th.textMuted, fontSize:13, lineHeight:1.6, marginBottom:24 }}>Möchtest du dieses Wort wirklich löschen? Das kann nicht rückgängig gemacht werden.</p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:6, color:th.textMuted, fontSize:12, fontFamily:"inherit", padding:"8px 20px", cursor:"pointer" }}>Abbrechen</button>
              <button onClick={() => handleDelete(deleteConfirmId)} style={{ background:th.red, border:"none", borderRadius:6, color:"#fff", fontSize:12, fontFamily:"inherit", fontWeight:"bold", padding:"8px 20px", cursor:"pointer" }}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ThemeCtx.Provider>
  );
}
