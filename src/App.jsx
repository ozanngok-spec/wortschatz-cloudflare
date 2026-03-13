import { useState, useEffect, useRef, useCallback } from "react";
import { ThemeCtx, DARK, LIGHT } from "./theme.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { sbFetch, hashPin } from "./lib/supabase.js";
import { fetchExampleSentences, fetchWordOfTheDay } from "./lib/api.js";
import { TYPE_FILTERS, matchesTypeFilter, typeColor, levelColor } from "./lib/helpers.js";
import { SpeakBtn } from "./components/SpeakBtn.jsx";
import { PronunciationPractice } from "./components/PronunciationPractice.jsx";
import { WordOfTheDay } from "./components/WordOfTheDay.jsx";
import { PinScreen } from "./components/PinScreen.jsx";
import { TagManager } from "./components/TagManager.jsx";
import { TextAnalyzer } from "./components/TextAnalyzer.jsx";
import { SpotifyPlayer } from "./components/SpotifyPlayer.jsx";
import { QuizMode } from "./components/QuizMode.jsx";
import { handleCallback as handleSpotifyCallback } from "./lib/spotify.js";

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
  const [activeTab, setActiveTab] = useState("woerter");
  const [showQuiz, setShowQuiz] = useState(false);
  const [tagFilter, setTagFilter] = useState(null);
  const [reviewMap, setReviewMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wortschatz-quiz-reviews") || "{}"); } catch { return {}; }
  });

  useEffect(() => {
    const stored = sessionStorage.getItem("wortschatz-uid");
    if (stored) setUserId(stored);
    setStorageLoading(false);
    handleSpotifyCallback();
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
      setWords((data||[]).map(w => ({ id:w.id, word:w.word, translation:w.translation, type:w.type, level:w.level||'', explanation:w.explanation, sentences:w.sentences, forms:w.forms||null, mastered:w.mastered, addedAt:w.added_at, tags:w.tags||[] })));
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
    const result = await sbFetch("/rest/v1/vocabulary", { method:"POST", body:JSON.stringify({ user_id:userId, word:finalWord, translation:ai.translation, type:ai.type, level:ai.level||"", explanation:ai.explanation, sentences:ai.sentences, forms:ai.forms||null, mastered:false, tags:[] }) });
    const inserted = Array.isArray(result) ? result[0] : result;
    setWords(prev => [{ id:inserted.id, word:inserted.word, translation:inserted.translation, type:inserted.type, level:inserted.level||'', explanation:inserted.explanation, sentences:inserted.sentences, forms:ai.forms||inserted.forms||null, mastered:inserted.mastered, addedAt:inserted.added_at, tags:[] }, ...prev]);
    setInput(""); setExpandedId(inserted.id); setSuggestion(null);
  };

  const handleAddFromExternal = async (wordStr) => {
    const ai = await fetchExampleSentences(wordStr);
    const finalWord = ai.word || wordStr;
    if (words.find(w => w.word.toLowerCase() === finalWord.toLowerCase())) return;
    await saveWord(finalWord, ai);
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

  const updateTags = async (id, newTags) => {
    try {
      await sbFetch(`/rest/v1/vocabulary?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ tags:newTags }) });
      setWords(prev => prev.map(w => w.id===id ? { ...w, tags:newTags } : w));
    } catch(e) { console.error("Tags update failed:", e); }
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

  const handleQuizAnswer = useCallback((wordId, isCorrect) => {
    setReviewMap(prev => {
      const r = prev[wordId] || { correct:0, total:0 };
      return { ...prev, [wordId]: { lastReviewed:Date.now(), correct: r.correct + (isCorrect?1:0), total: r.total+1 } };
    });
  }, []);

  const allTags = [...new Set(words.flatMap(w => w.tags || []))].sort();
  const filteredWords = words.filter(w => matchesTypeFilter(w, filter) && (!tagFilter || (w.tags||[]).includes(tagFilter)));
  const quizzedCount = words.filter(w => (reviewMap[w.id]?.total||0) > 0).length;
  const totalQuizCorrect = words.reduce((acc, w) => acc + (reviewMap[w.id]?.correct||0), 0);
  const totalQuizAttempts = words.reduce((acc, w) => acc + (reviewMap[w.id]?.total||0), 0);

  if (storageLoading) return <div style={{ minHeight:"100vh", background:th.bg, display:"flex", alignItems:"center", justifyContent:"center", color:th.textFaint, fontFamily:"'Inter',system-ui,sans-serif", fontSize:13 }}>Laden…</div>;
  if (!userId) return <PinScreen onEnter={handlePin} darkMode={darkMode} toggleDark={toggleDark} />;

  const TABS = [
    { key:"woerter",  label:"Wörter",  emoji:"📖" },
    { key:"heute",    label:"Heute",   emoji:"📅" },
    { key:"spotify",  label:"Spotify", emoji:"🎵" },
    { key:"analyse",  label:"Analyse", emoji:"📝" },
  ];

  const popup = { background:th.bgCard, border:`1px solid ${th.border}`, borderRadius:18, padding:"32px 36px", maxWidth:390, width:"92%", textAlign:"center", fontFamily:"'Inter',system-ui,sans-serif", boxShadow: th.isDark ? "0 24px 80px rgba(0,0,0,0.7)" : "0 24px 80px rgba(0,0,0,0.13)" };
  const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 };
  const pad = th.isMobile ? "0 16px" : "0 36px";

  return (
    <ThemeCtx.Provider value={th}>
    <div style={{ minHeight:"100vh", background:th.bg, fontFamily:"'Inter',system-ui,sans-serif", color:th.text, transition:"background 0.3s, color 0.3s", paddingBottom: th.isMobile ? 72 : 0 }}>

      {/* ── Header ── */}
      <div style={{ borderBottom:`1px solid ${th.border}`, background: th.isDark ? "rgba(13,13,18,0.92)" : "rgba(244,244,251,0.92)", position:"sticky", top:0, zIndex:20, backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)" }}>
        <div style={{ maxWidth:740, margin:"0 auto", padding: th.isMobile ? "13px 16px" : "14px 36px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:7 }}>
            <span style={{ fontSize:19, fontWeight:700, color:th.text, fontFamily:"'Lora',Georgia,serif", letterSpacing:"-0.01em" }}>Wortschatz</span>
            <span style={{ fontSize:9, color:th.textFaint, letterSpacing:"0.16em", textTransform:"uppercase", fontWeight:500 }}>C1</span>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button onClick={toggleDark} title={darkMode?"Heller Modus":"Dunkler Modus"} style={{ background:"transparent", border:`1px solid ${th.border}`, borderRadius:8, padding:"6px 10px", fontSize:14, cursor:"pointer", color:th.textMuted, lineHeight:1 }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button onClick={handleLogout} style={{ background:"transparent", border:`1px solid ${th.border}`, borderRadius:8, color:th.textFaint, fontSize:11, fontFamily:"inherit", fontWeight:500, padding:"6px 12px", cursor:"pointer", letterSpacing:"0.02em" }}>
              {th.isMobile ? "🔒" : "Sperren"}
            </button>
          </div>
        </div>

        {/* Desktop tab bar — inside header */}
        {!th.isMobile && (
          <div style={{ maxWidth:740, margin:"0 auto", padding:"0 36px", display:"flex", gap:0, borderTop:`1px solid ${th.border}` }}>
            {TABS.map(({ key, label, emoji }) => {
              const active = activeTab === key;
              return (
                <button key={key} onClick={() => setActiveTab(key)} style={{ background:"transparent", border:"none", borderBottom:`2px solid ${active ? th.accent : "transparent"}`, color: active ? th.accent : th.textMuted, fontSize:12, fontFamily:"inherit", fontWeight: active ? 600 : 400, padding:"11px 18px", cursor:"pointer", letterSpacing:"0.02em", transition:"all 0.15s", display:"flex", alignItems:"center", gap:6, marginBottom:-1 }}>
                  <span style={{ fontSize:13 }}>{emoji}</span>{label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth:740, margin:"0 auto", padding: th.isMobile ? "20px 16px 0" : "28px 36px 0" }}>

        {/* ── WÖRTER TAB ── */}
        {activeTab === "woerter" && (<>

          {/* Add word input */}
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <input value={input} onChange={e => { setInput(e.target.value); setError(""); setSuggestion(null); }}
                onKeyDown={e => e.key==="Enter" && !loading && handleAdd()}
                placeholder="Deutsches Wort oder Ausdruck…"
                style={{ flex:1, background:th.bgInput, border:`1.5px solid ${th.borderMid}`, borderRadius:12, padding:"12px 16px", fontSize:th.isMobile?16:15, color:th.text, outline:"none", fontFamily:"inherit", boxShadow: th.isDark ? "none" : "0 1px 4px rgba(0,0,0,0.06)" }} />
              <button onClick={isListening ? stopListening : startListening}
                style={{ background:isListening?th.red:th.bgInput, border:`1.5px solid ${isListening?th.red:th.borderMid}`, borderRadius:12, padding:"12px 14px", fontSize:16, cursor:"pointer", transition:"all 0.2s", lineHeight:1, flexShrink:0 }}>
                {isListening ? "⏹" : "🎤"}
              </button>
              <button onClick={handleAdd} disabled={loading||!input.trim()}
                style={{ background:loading?th.bgCard:th.accent, color:loading?th.textFaint:"#fff", border:"none", borderRadius:12, padding:"12px 20px", fontSize:12, fontFamily:"inherit", fontWeight:600, letterSpacing:"0.04em", cursor:loading?"not-allowed":"pointer", whiteSpace:"nowrap", flexShrink:0, boxShadow: loading?"none":`0 2px 12px ${th.accent}44` }}>
                {loading ? "…" : th.isMobile ? "+" : "Hinzufügen"}
              </button>
            </div>
            {isListening && <p style={{ color:th.accent, fontSize:12, margin:0 }}>🎤 Höre zu… jetzt auf Deutsch sprechen</p>}
            {error && <p style={{ color:th.red, fontSize:12, margin:0 }}>{error}</p>}
          </div>

          {/* Stats + Quiz row */}
          <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
            {/* Stats card */}
            <div style={{ flex:1, minWidth:140, background:th.bgCard, border:`1.5px solid ${th.border}`, borderRadius:14, padding:"14px 18px", display:"flex", flexDirection:"column", gap:6, boxShadow: th.isDark?"none":"0 2px 12px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600 }}>Dein Fortschritt</div>
              <div style={{ display:"flex", gap:16, alignItems:"baseline" }}>
                <div>
                  <span style={{ fontSize:22, fontWeight:700, color:th.text }}>{words.length}</span>
                  <span style={{ fontSize:10, color:th.textFaint, marginLeft:4 }}>Wörter</span>
                </div>
                <div>
                  <span style={{ fontSize:22, fontWeight:700, color:th.green }}>{words.filter(w=>w.mastered).length}</span>
                  <span style={{ fontSize:10, color:th.textFaint, marginLeft:4 }}>gelernt</span>
                </div>
                <div>
                  <span style={{ fontSize:22, fontWeight:700, color:th.accent }}>{words.filter(w=>!w.mastered).length}</span>
                  <span style={{ fontSize:10, color:th.textFaint, marginLeft:4 }}>offen</span>
                </div>
              </div>
              {words.length > 0 && (
                <div style={{ height:4, background:th.bgInset, borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(words.filter(w=>w.mastered).length/words.length)*100}%`, background:th.green, borderRadius:2, transition:"width 0.4s" }} />
                </div>
              )}
              {totalQuizAttempts > 0 && (
                <div style={{ fontSize:10, color:th.textFaint, display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                  <span>🧠</span>
                  <span>{quizzedCount} geübt</span>
                  <span style={{ color:th.textDim }}>·</span>
                  <span style={{ color:th.green }}>{Math.round(totalQuizCorrect/totalQuizAttempts*100)}% richtig</span>
                </div>
              )}
            </div>

            {/* Quiz card */}
            <button onClick={() => setShowQuiz(true)} style={{ flex:1, minWidth:140, background: th.isDark ? `linear-gradient(135deg, #1a1430 0%, #0f0d1a 100%)` : `linear-gradient(135deg, #eae8ff 0%, #f0eeff 100%)`, border:`1.5px solid ${th.accent}44`, borderRadius:14, padding:"14px 18px", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:4, boxShadow:`0 2px 20px ${th.accent}22` }}>
              <div style={{ fontSize:24 }}>🧠</div>
              <div style={{ fontSize:13, fontWeight:600, color:th.accent }}>Quiz starten</div>
              <div style={{ fontSize:11, color:th.textMuted }}>{words.filter(w=>!w.mastered).length} bereit{quizzedCount > 0 ? ` · ${quizzedCount} geübt` : ""}</div>
            </button>
          </div>

          {/* Filters */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
              {TYPE_FILTERS.map(({ key, label }) => {
                const count = key==="all" ? words.length : words.filter(w => matchesTypeFilter(w, key)).length;
                const active = filter===key;
                return (
                  <button key={key} onClick={() => setFilter(key)} style={{ display:"flex", alignItems:"center", gap:5, background:active?th.accent:th.bgCard, color:active?"#fff":th.textMuted, border:`1.5px solid ${active?th.accent:th.border}`, borderRadius:999, padding:th.isMobile?"4px 10px":"5px 13px", fontSize:th.isMobile?10:11, fontFamily:"inherit", fontWeight:active?600:400, cursor:"pointer", transition:"all 0.15s" }}>
                    {label}
                    <span style={{ fontSize:10, background:active?"rgba(255,255,255,0.2)":th.pillBg, borderRadius:6, padding:"0 5px" }}>{count}</span>
                  </button>
                );
              })}
            </div>
            {allTags.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.08em", textTransform:"uppercase", flexShrink:0 }}>Thema</span>
                <select value={tagFilter||""} onChange={e => setTagFilter(e.target.value||null)} style={{ background:tagFilter?th.accentBg:th.bgCard, color:tagFilter?th.accent:th.textMuted, border:`1.5px solid ${tagFilter?th.accent+"66":th.border}`, borderRadius:8, padding:"4px 28px 4px 10px", fontSize:11, fontFamily:"inherit", cursor:"pointer", outline:"none", appearance:"none", WebkitAppearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center" }}>
                  <option value="">Alle Themen</option>
                  {allTags.map(tag => <option key={tag} value={tag}>#{tag}</option>)}
                </select>
                {tagFilter && <button onClick={() => setTagFilter(null)} style={{ background:"transparent", border:"none", color:th.textFaint, fontSize:16, cursor:"pointer", lineHeight:1, padding:"0 2px" }}>×</button>}
              </div>
            )}
          </div>

          {/* Word list */}
          <div style={{ paddingBottom: th.isMobile ? 16 : 48 }}>
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
                <div key={w.id} style={{ background:th.bgCard, border:`1.5px solid ${expandedId===w.id?th.borderActive:th.border}`, borderRadius:14, marginBottom:6, overflow:"hidden", opacity:w.mastered?0.45:1, transition:"all 0.2s", boxShadow: th.isDark ? "0 1px 0 rgba(255,255,255,0.03)" : "0 2px 10px rgba(0,0,0,0.05)" }}>
                  <div onClick={() => setExpandedId(expandedId===w.id?null:w.id)} style={{ display:"flex", alignItems:"center", padding:th.isMobile?"12px 14px":"13px 18px", cursor:"pointer", gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontSize:16, fontFamily:"'Lora',Georgia,serif", fontWeight:500, color:w.mastered?th.textFaint:th.text, textDecoration:w.mastered?"line-through":"none" }}>{w.word}</span>
                        <SpeakBtn text={w.word} size={12} />
                        <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:tc.bg, color:tc.text, letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:600 }}>{w.type}</span>
                        {w.level && (() => { const lc = levelColor(w.level, th); return <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:lc.bg, color:lc.text, letterSpacing:"0.08em", fontWeight:700 }}>{w.level}</span>; })()}
                      </div>
                      <div style={{ fontSize:13, color:th.textMuted, marginTop:3 }}>{w.translation}</div>
                      {w.forms && <div style={{ fontSize:12, color:th.textWarm, marginTop:2, fontFamily:"'Lora',Georgia,serif", fontStyle:"italic" }}>{w.forms}</div>}
                      {(w.tags||[]).length>0 && (
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:4 }}>
                          {(w.tags||[]).map(tag => <span key={tag} onClick={e => { e.stopPropagation(); setTagFilter(tag===tagFilter?null:tag); }} style={{ fontSize:10, color:th.accent, background:th.accentBg, border:`1px solid ${th.accent}33`, borderRadius:20, padding:"1px 7px", cursor:"pointer" }}>#{tag}</span>)}
                        </div>
                      )}
                      {(() => {
                        const r = reviewMap[w.id];
                        if (!r || r.total === 0) return null;
                        const dots = Math.min(r.correct, 5);
                        return (
                          <div style={{ display:"flex", gap:3, marginTop:5, alignItems:"center" }}>
                            {[1,2,3,4,5].map(i => (
                              <div key={i} style={{ width:6, height:6, borderRadius:"50%", background: i<=dots ? th.green : th.border, transition:"background 0.3s" }} />
                            ))}
                            <span style={{ fontSize:9, color:th.textFaint, marginLeft:4 }}>🧠 {r.correct}/{r.total}</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                      <button onClick={e => { e.stopPropagation(); toggleMastered(w.id, w.mastered); }} style={{ background:w.mastered?th.accent+"22":"transparent", border:`1.5px solid ${w.mastered?th.accent:th.border}`, color:w.mastered?th.accent:th.textFaint, borderRadius:6, padding:"3px 8px", fontSize:10, fontFamily:"inherit", fontWeight:500, cursor:"pointer" }}>
                        {w.mastered ? "✓" : th.isMobile ? "✓?" : "Gelernt?"}
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(w.id); }} onMouseEnter={e=>e.target.style.color=th.red} onMouseLeave={e=>e.target.style.color=th.textFaint} style={{ background:"transparent", border:"none", color:th.textFaint, fontSize:18, cursor:"pointer", padding:"2px 4px", lineHeight:1, transition:"color 0.15s" }}>×</button>
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
                              <span>{s.german.split(new RegExp(`(${w.word})`,"gi")).map((part,j) => part.toLowerCase()===w.word.toLowerCase() ? <span key={j} style={{ color:th.accent }}>{part}</span> : part)}</span>
                              <SpeakBtn text={s.german} size={12} />
                            </div>
                            <div style={{ fontSize:12, color:th.textMuted, lineHeight:1.5 }}>{s.english}</div>
                          </div>
                        ))}
                      </div>
                      <PronunciationPractice word={w.word} />
                      <TagManager tags={w.tags||[]} onUpdate={(newTags) => updateTags(w.id, newTags)} />
                      {reviewMap[w.id]?.total > 0 && (
                        <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${th.border}` }}>
                          <div style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, marginBottom:8 }}>Quiz-Fortschritt</div>
                          <div style={{ display:"flex", gap:4, marginBottom:6 }}>
                            {[1,2,3,4,5].map(i => (
                              <div key={i} style={{ flex:1, height:5, borderRadius:3, background: i<=Math.min(reviewMap[w.id].correct,5) ? th.green : th.bgInset, transition:"background 0.3s" }} />
                            ))}
                          </div>
                          <div style={{ fontSize:11, color:th.textFaint }}>
                            {reviewMap[w.id].correct} von {reviewMap[w.id].total} Versuchen richtig
                            {reviewMap[w.id].correct >= 5 && <span style={{ color:th.green, marginLeft:8 }}>· Gut gemeistert! ✨</span>}
                          </div>
                        </div>
                      )}
                      <div style={{ fontSize:9, color:th.textDim, marginTop:14 }}>Hinzugefügt am {new Date(w.addedAt).toLocaleDateString("de-DE",{day:"numeric",month:"short",year:"numeric"})}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>)}

        {/* ── HEUTE TAB ── */}
        {activeTab === "heute" && (
          <div style={{ paddingBottom:48 }}>
            <div style={{ marginBottom:6 }}>
              <div style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600, marginBottom:14 }}>Wort des Tages</div>
              <WordOfTheDay wotd={wotd} loading={wotdLoading} alreadyAdded={!!(wotd && words.some(w => w.word.toLowerCase()===wotd.word.toLowerCase()))} onAdd={handleAddWotd} adding={wotdAdding} onRefresh={handleRefreshWotd} />
            </div>
          </div>
        )}

        {/* ── SPOTIFY TAB ── */}
        {activeTab === "spotify" && (
          <div style={{ paddingBottom:48 }}>
            <div style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600, marginBottom:14 }}>Spotify – Aktueller Song</div>
            <SpotifyPlayer userId={userId} words={words} onSaveWord={handleAddFromExternal} />
          </div>
        )}

        {/* ── ANALYSE TAB ── */}
        {activeTab === "analyse" && (
          <div style={{ paddingBottom:48 }}>
            <div style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600, marginBottom:14 }}>Textanalyse</div>
            <TextAnalyzer words={words} />
          </div>
        )}

      </div>

      {/* ── Mobile bottom nav ── */}
      {th.isMobile && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:20, background: th.isDark ? "rgba(13,13,18,0.96)" : "rgba(244,244,251,0.96)", borderTop:`1px solid ${th.border}`, backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)", display:"flex", padding:"8px 0 max(8px,env(safe-area-inset-bottom))" }}>
          {TABS.map(({ key, label, emoji }) => {
            const active = activeTab===key;
            return (
              <button key={key} onClick={() => setActiveTab(key)} style={{ flex:1, background:"transparent", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"4px 0" }}>
                <span style={{ fontSize:20, lineHeight:1 }}>{emoji}</span>
                <span style={{ fontSize:9, fontFamily:"inherit", fontWeight:active?600:400, color:active?th.accent:th.textFaint, letterSpacing:"0.04em" }}>{label}</span>
                {active && <div style={{ width:18, height:2, background:th.accent, borderRadius:1, marginTop:1 }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}

      {/* Quiz */}
      {showQuiz && <QuizMode words={words} onClose={() => setShowQuiz(false)} onAnswer={handleQuizAnswer} />}

      {/* Suggestion / Meintest du? */}
      {suggestion && (() => {
        const isCorrected = suggestion.corrected.toLowerCase() !== suggestion.original.toLowerCase();
        const tc = typeColor(suggestion.ai.type, th);
        const lc = levelColor(suggestion.ai.level, th);
        return (
          <div style={overlay} onClick={() => setSuggestion(null)}>
            <div onClick={e=>e.stopPropagation()} style={{ ...popup, maxWidth:400 }}>
              <div style={{ fontSize:20, marginBottom:8 }}>{isCorrected ? "✏️" : "📖"}</div>
              <p style={{ color:th.textMuted, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14, fontWeight:600 }}>{isCorrected ? "Meintest du...?" : "Wort bestätigen"}</p>
              <p style={{ color:th.text, fontSize:22, fontFamily:"'Lora',Georgia,serif", fontStyle:"italic", marginBottom:6 }}>{suggestion.corrected}</p>
              {isCorrected && <p style={{ color:th.textFaint, fontSize:12, marginBottom:10 }}>statt <span style={{ textDecoration:"line-through", color:th.textDim }}>{suggestion.original}</span></p>}
              <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap", marginBottom:10 }}>
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:5, background:tc.bg, color:tc.text, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase" }}>{suggestion.ai.type}</span>
                {suggestion.ai.level && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:5, background:lc.bg, color:lc.text, fontWeight:700, letterSpacing:"0.08em" }}>{suggestion.ai.level}</span>}
              </div>
              <p style={{ fontSize:13, color:th.textMuted, marginBottom:6 }}>{suggestion.ai.translation}</p>
              {suggestion.ai.forms && <p style={{ fontSize:12, color:th.textWarm, fontFamily:"'Lora',Georgia,serif", fontStyle:"italic", marginBottom:14 }}>{suggestion.ai.forms}</p>}
              {!suggestion.ai.forms && <div style={{ marginBottom:14 }} />}
              <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                <button onClick={() => setSuggestion(null)} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:10, color:th.textMuted, fontSize:12, fontFamily:"inherit", padding:"9px 16px", cursor:"pointer" }}>Abbrechen</button>
                {isCorrected && <button onClick={rejectSuggestion} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:10, color:th.textMuted, fontSize:12, fontFamily:"inherit", padding:"9px 16px", cursor:"pointer" }}>So behalten</button>}
                <button onClick={acceptSuggestion} style={{ background:th.accent, border:"none", borderRadius:10, color:"#fff", fontSize:12, fontFamily:"inherit", fontWeight:"bold", padding:"9px 18px", cursor:"pointer", boxShadow:`0 2px 10px ${th.accent}55` }}>
                  {isCorrected ? "Ja, korrigieren" : "Hinzufügen"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Löschen */}
      {deleteConfirmId && (
        <div style={overlay} onClick={() => setDeleteConfirmId(null)}>
          <div onClick={e=>e.stopPropagation()} style={popup}>
            <div style={{ fontSize:22, marginBottom:12 }}>🗑️</div>
            <p style={{ color:th.text, fontSize:15, marginBottom:6 }}><strong>{words.find(w=>w.id===deleteConfirmId)?.word}</strong></p>
            <p style={{ color:th.textMuted, fontSize:13, lineHeight:1.6, marginBottom:24 }}>Möchtest du dieses Wort wirklich löschen? Das kann nicht rückgängig gemacht werden.</p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:10, color:th.textMuted, fontSize:12, fontFamily:"inherit", padding:"8px 20px", cursor:"pointer" }}>Abbrechen</button>
              <button onClick={() => handleDelete(deleteConfirmId)} style={{ background:th.red, border:"none", borderRadius:10, color:"#fff", fontSize:12, fontFamily:"inherit", fontWeight:"bold", padding:"8px 20px", cursor:"pointer", boxShadow:`0 2px 10px ${th.red}55` }}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ThemeCtx.Provider>
  );
}
