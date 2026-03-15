import { useState, useRef, useEffect } from "react";
import { DARK, LIGHT } from "../theme.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import {
  fetchTravelPhrases,
  fetchTravelSituation,
  fetchTravelRoleplay,
  speakTravelTts,
} from "../lib/api.js";

const SPEECH_LANG_MAP = {
  de: "de-DE", es: "es-ES", fr: "fr-FR", it: "it-IT", pt: "pt-PT",
  ja: "ja-JP", zh: "zh-CN", ko: "ko-KR", nl: "nl-NL", tr: "tr-TR", id: "id-ID",
};

const CATEGORIES = [
  { key: "airport",     emoji: "✈️",  label: "Airport" },
  { key: "hotel",       emoji: "🏨",  label: "Hotel" },
  { key: "restaurant",  emoji: "🍽️", label: "Food" },
  { key: "transport",   emoji: "🚌",  label: "Transport" },
  { key: "emergency",   emoji: "🚨",  label: "Emergency" },
  { key: "shopping",    emoji: "🛍️", label: "Shopping" },
  { key: "directions",  emoji: "🗺️", label: "Directions" },
  { key: "social",      emoji: "💬",  label: "Social" },
];

const SCENARIOS = [
  { key: "hotel_checkin",       label: "Hotel check-in",     emoji: "🏨" },
  { key: "restaurant_order",    label: "Ordering food",      emoji: "🍽️" },
  { key: "taxi",                label: "Taking a taxi",      emoji: "🚕" },
  { key: "directions",          label: "Asking directions",  emoji: "🗺️" },
  { key: "market",              label: "Market shopping",    emoji: "🛍️" },
  { key: "pharmacy",            label: "At the pharmacy",    emoji: "💊" },
];

export function TravelCompanion({ targetLang, darkMode }) {
  const isMobile = useIsMobile();
  const th = { ...(darkMode ? DARK : LIGHT), isMobile };

  const [tab, setTab] = useState("phrases");

  // ── Phrases ──────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [phrases, setPhrases] = useState(null);
  const [phrasesLoading, setPhrasesLoading] = useState(false);

  // ── Situation ─────────────────────────────────────────────────────────
  const [situation, setSituation] = useState("");
  const [situationResult, setSituationResult] = useState(null);
  const [situationLoading, setSituationLoading] = useState(false);
  const [sitListening, setSitListening] = useState(false);

  // ── Practice ──────────────────────────────────────────────────────────
  const [scenario, setScenario] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceListening, setPracticeListening] = useState(false);
  const convEndRef = useRef(null);

  // ── TTS ───────────────────────────────────────────────────────────────
  const [speakingId, setSpeakingId] = useState(null);
  const currentAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const stopCurrentAudio = () => {
    try { sourceNodeRef.current?.stop(); } catch (e) {}
    sourceNodeRef.current = null;
    currentAudioRef.current?.pause();
    currentAudioRef.current = null;
    window.speechSynthesis.cancel();
  };

  useEffect(() => {
    convEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Stop audio when switching tabs
  useEffect(() => {
    stopCurrentAudio();
    setSpeakingId(null);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const speakBrowser = (text) => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = SPEECH_LANG_MAP[targetLang] || "en-US";
    utt.rate = 0.9;
    utt.onend = () => setSpeakingId(null);
    utt.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utt);
  };

  const speakText = async (text, id) => {
    if (speakingId === id) {
      stopCurrentAudio();
      setSpeakingId(null);
      return;
    }
    stopCurrentAudio();
    setSpeakingId(id);
    try {
      const blob = await speakTravelTts(text);
      const arrayBuffer = await blob.arrayBuffer();
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Play 200ms of silence first to warm up audio hardware
      const silence = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.2), ctx.sampleRate);
      const warmup = ctx.createBufferSource();
      warmup.buffer = silence;
      warmup.connect(ctx.destination);
      warmup.start(ctx.currentTime);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setSpeakingId(null);
      sourceNodeRef.current = source;
      source.start(ctx.currentTime + 0.2);
    } catch (e) {
      // ElevenLabs unavailable — fall back to browser TTS
      speakBrowser(text);
    }
  };

  // ── Phrases tab ───────────────────────────────────────────────────────
  const phraseCacheKey = (cat) => `travel-phrases-${targetLang}-${cat}`;

  const loadPhrases = async (category) => {
    setSelectedCategory(category);
    const cached = localStorage.getItem(phraseCacheKey(category.key));
    if (cached) {
      try { setPhrases(JSON.parse(cached)); return; } catch (e) {}
    }
    setPhrasesLoading(true);
    setPhrases(null);
    try {
      const data = await fetchTravelPhrases(category.key, targetLang);
      setPhrases(data.phrases || []);
      localStorage.setItem(phraseCacheKey(category.key), JSON.stringify(data.phrases || []));
    } catch (e) { console.error(e); }
    setPhrasesLoading(false);
  };

  const backToCategories = () => {
    setSelectedCategory(null);
    setPhrases(null);
  };

  // ── Situation tab ─────────────────────────────────────────────────────
  const handleSituation = async () => {
    if (!situation.trim() || situationLoading) return;
    setSituationLoading(true);
    setSituationResult(null);
    try {
      const data = await fetchTravelSituation(situation, targetLang);
      setSituationResult(data);
    } catch (e) { console.error(e); }
    setSituationLoading(false);
  };

  const startSitListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US";
    r.onresult = (e) => { setSituation(e.results[0][0].transcript); setSitListening(false); };
    r.onerror = r.onend = () => setSitListening(false);
    r.start(); setSitListening(true);
  };

  // ── Practice tab ──────────────────────────────────────────────────────
  const startPractice = async (sc) => {
    setScenario(sc);
    setConversation([]);
    setPracticeLoading(true);
    try {
      const data = await fetchTravelRoleplay(sc.label, [], targetLang, true);
      setConversation([{
        role: "local",
        content: data.reply,
        translation: data.translation,
        romanization: data.romanization,
      }]);
    } catch (e) { console.error(e); }
    setPracticeLoading(false);
  };

  const sendPracticeMessage = async () => {
    if (!userInput.trim() || practiceLoading) return;
    const msg = userInput.trim();
    setUserInput("");
    const newConv = [...conversation, { role: "user", content: msg }];
    setConversation(newConv);
    setPracticeLoading(true);
    try {
      const data = await fetchTravelRoleplay(scenario.label, newConv, targetLang, false);
      setConversation(prev => [...prev, {
        role: "local",
        content: data.reply,
        translation: data.translation,
        romanization: data.romanization,
        feedback: data.feedback,
      }]);
    } catch (e) { console.error(e); }
    setPracticeLoading(false);
  };

  const startPracticeListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = SPEECH_LANG_MAP[targetLang] || "en-US";
    r.onresult = (e) => { setUserInput(e.results[0][0].transcript); setPracticeListening(false); };
    r.onerror = r.onend = () => setPracticeListening(false);
    r.start(); setPracticeListening(true);
  };

  // ── Shared styles ─────────────────────────────────────────────────────
  const cardStyle = {
    background: th.bgCard,
    border: `1.5px solid ${th.border}`,
    borderRadius: 14,
    padding: isMobile ? "14px 16px" : "16px 20px",
  };

  const SpeakButton = ({ text, id, size = 13 }) => (
    <button
      onClick={() => speakText(text, id)}
      style={{
        background: speakingId === id ? th.accent + "22" : "transparent",
        border: `1px solid ${speakingId === id ? th.accent : th.border}`,
        borderRadius: 8, padding: "5px 8px", fontSize: size,
        cursor: "pointer", color: speakingId === id ? th.accent : th.textFaint,
        lineHeight: 1, flexShrink: 0, minWidth: 32, minHeight: 32,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      title="Listen"
    >
      {speakingId === id ? "⏹" : "🔊"}
    </button>
  );

  // ── Tab bar ───────────────────────────────────────────────────────────
  const TABS = [
    { key: "phrases",   label: "Phrasebook", emoji: "📖" },
    { key: "situation", label: "Situation",  emoji: "💡" },
    { key: "practice",  label: "Practice",   emoji: "🎭" },
  ];

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Section header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>✈️</span>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 700, color: th.text, fontFamily: "'Lora',Georgia,serif" }}>
            Travel Companion
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: th.textMuted }}>
          Phrasebook · Situation help · Conversation practice
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: th.bgCard, borderRadius: 12, padding: 4, border: `1px solid ${th.border}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, background: tab === t.key ? th.accent : "transparent",
            border: "none", borderRadius: 9, padding: isMobile ? "8px 4px" : "8px 12px",
            fontSize: isMobile ? 11 : 12, fontFamily: "inherit", fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? "#fff" : th.textMuted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 13 }}>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PHRASEBOOK TAB ─────────────────────────────────────────────── */}
      {tab === "phrases" && (
        <>
          {!selectedCategory ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(4, 1fr)" : "repeat(4, 1fr)",
              gap: 8,
            }}>
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => loadPhrases(cat)} style={{
                  ...cardStyle,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 6, cursor: "pointer", padding: isMobile ? "12px 8px" : "16px 12px",
                  transition: "all 0.15s", border: `1.5px solid ${th.border}`,
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = th.accent + "66"; e.currentTarget.style.background = th.accent + "0a"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.background = th.bgCard; }}
                >
                  <span style={{ fontSize: isMobile ? 22 : 26 }}>{cat.emoji}</span>
                  <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 600, color: th.text, textAlign: "center" }}>{cat.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Back + category header */}
              <button onClick={backToCategories} style={{
                background: "none", border: "none", color: th.textFaint, cursor: "pointer",
                fontSize: 13, padding: "0 0 16px", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
              }}>
                ← Back
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{selectedCategory.emoji}</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: th.text }}>{selectedCategory.label}</h3>
              </div>

              {phrasesLoading && (
                <div style={{ textAlign: "center", padding: "40px 0", color: th.textFaint, fontSize: 13 }}>
                  Generating phrases…
                </div>
              )}

              {phrases && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {phrases.map((p, i) => (
                    <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: th.text, marginBottom: 2 }}>
                          {p.target}
                        </div>
                        {p.romanization && (
                          <div style={{ fontSize: 12, color: th.textMuted, marginBottom: 2, fontStyle: "italic" }}>
                            {p.romanization}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: th.textMuted }}>{p.english}</div>
                        {p.note && (
                          <div style={{ fontSize: 11, color: th.textFaint, marginTop: 4 }}>
                            💡 {p.note}
                          </div>
                        )}
                      </div>
                      <SpeakButton text={p.target} id={`phrase-${i}`} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── SITUATION TAB ──────────────────────────────────────────────── */}
      {tab === "situation" && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, display: "block", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Describe your situation
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                value={situation}
                onChange={e => setSituation(e.target.value)}
                placeholder="e.g. I'm at the hotel reception and they lost my reservation…"
                rows={3}
                style={{
                  flex: 1, background: th.bgInput, border: `1.5px solid ${th.borderMid}`,
                  borderRadius: 12, padding: "12px 14px", fontSize: isMobile ? 15 : 14,
                  color: th.text, fontFamily: "inherit", resize: "none", outline: "none",
                  lineHeight: 1.5,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={startSitListen} style={{
                background: sitListening ? th.red + "22" : th.bgCard,
                border: `1.5px solid ${sitListening ? th.red : th.borderMid}`,
                borderRadius: 10, padding: "10px 14px", fontSize: 14, cursor: "pointer",
                color: sitListening ? th.red : th.textMuted, lineHeight: 1,
              }}>
                {sitListening ? "⏹" : "🎤"}
              </button>
              <button onClick={handleSituation} disabled={!situation.trim() || situationLoading} style={{
                flex: 1, background: !situation.trim() || situationLoading ? th.bgCard : th.accent,
                color: !situation.trim() || situationLoading ? th.textFaint : "#fff",
                border: "none", borderRadius: 10, padding: "10px 16px",
                fontSize: 13, fontFamily: "inherit", fontWeight: 600, cursor: !situation.trim() || situationLoading ? "not-allowed" : "pointer",
              }}>
                {situationLoading ? "Thinking…" : "What should I say?"}
              </button>
            </div>
          </div>

          {situationResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Phrases to say */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: th.accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Say this
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(situationResult.phrases || []).map((p, i) => (
                    <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: th.text, marginBottom: 2 }}>{p.target}</div>
                        {p.romanization && <div style={{ fontSize: 12, color: th.textMuted, marginBottom: 2, fontStyle: "italic" }}>{p.romanization}</div>}
                        <div style={{ fontSize: 12, color: th.textMuted }}>{p.english}</div>
                        {p.when && <div style={{ fontSize: 11, color: th.textFaint, marginTop: 3 }}>→ {p.when}</div>}
                      </div>
                      <SpeakButton text={p.target} id={`sit-phrase-${i}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* What you might hear */}
              {(situationResult.responses || []).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: th.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                    You might hear
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {situationResult.responses.map((r, i) => (
                      <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{r.target}</div>
                          <div style={{ fontSize: 12, color: th.textMuted, marginTop: 2 }}>{r.english}</div>
                        </div>
                        <SpeakButton text={r.target} id={`sit-resp-${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              {(situationResult.tips || []).length > 0 && (
                <div style={{ ...cardStyle, background: th.accent + "0c", borderColor: th.accent + "33" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: th.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Tips</div>
                  {situationResult.tips.map((tip, i) => (
                    <div key={i} style={{ fontSize: 13, color: th.text, marginBottom: i < situationResult.tips.length - 1 ? 4 : 0 }}>
                      💡 {tip}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── PRACTICE TAB ───────────────────────────────────────────────── */}
      {tab === "practice" && (
        <>
          {!scenario ? (
            <>
              <div style={{ fontSize: 13, color: th.textMuted, marginBottom: 14 }}>
                Pick a scenario and practice speaking with a local.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 8 }}>
                {SCENARIOS.map(sc => (
                  <button key={sc.key} onClick={() => startPractice(sc)} style={{
                    ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 8, cursor: "pointer", padding: isMobile ? "16px 12px" : "20px 16px",
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = th.accent + "66"; e.currentTarget.style.background = th.accent + "0a"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.background = th.bgCard; }}
                  >
                    <span style={{ fontSize: 28 }}>{sc.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: th.text, textAlign: "center", lineHeight: 1.3 }}>{sc.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Scenario header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <button onClick={() => { setScenario(null); setConversation([]); }} style={{
                  background: "none", border: "none", color: th.textFaint, cursor: "pointer",
                  fontSize: 13, padding: 0, fontFamily: "inherit",
                }}>
                  ←
                </button>
                <span style={{ fontSize: 18 }}>{scenario.emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: th.text }}>{scenario.label}</div>
                  <div style={{ fontSize: 11, color: th.textFaint }}>Roleplay with a local</div>
                </div>
              </div>

              {/* Conversation */}
              <div style={{
                background: th.bgInput, borderRadius: 14, border: `1px solid ${th.border}`,
                padding: "12px", minHeight: 220, maxHeight: isMobile ? 340 : 420,
                overflowY: "auto", display: "flex", flexDirection: "column", gap: 10,
                marginBottom: 12,
              }}>
                {practiceLoading && conversation.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: th.textFaint, fontSize: 13 }}>
                    Setting the scene…
                  </div>
                )}
                {conversation.map((msg, i) => (
                  <div key={i}>
                    {msg.role === "local" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: th.textFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>Local</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <div style={{
                            background: th.bgCard, border: `1px solid ${th.border}`,
                            borderRadius: "4px 14px 14px 14px", padding: "10px 14px",
                            maxWidth: "85%",
                          }}>
                            <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: th.text, marginBottom: 2 }}>{msg.content}</div>
                            {msg.romanization && <div style={{ fontSize: 11, color: th.textMuted, fontStyle: "italic", marginBottom: 2 }}>{msg.romanization}</div>}
                            <div style={{ fontSize: 12, color: th.textMuted }}>{msg.translation}</div>
                          </div>
                          <SpeakButton text={msg.content} id={`conv-${i}`} size={12} />
                        </div>
                        {/* Feedback on previous user message */}
                        {msg.feedback && (msg.feedback.correction || msg.feedback.tip) && (
                          <div style={{
                            fontSize: 11, color: th.textFaint,
                            background: th.accent + "0c", border: `1px solid ${th.accent}22`,
                            borderRadius: 8, padding: "6px 10px", maxWidth: "85%", marginTop: 2,
                          }}>
                            {msg.feedback.correction && (
                              <div style={{ marginBottom: msg.feedback.tip ? 3 : 0 }}>
                                ✏️ <span style={{ color: th.accent, fontWeight: 600 }}>Correction:</span> {msg.feedback.correction}
                              </div>
                            )}
                            {msg.feedback.tip && <div>💡 {msg.feedback.tip}</div>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: th.textFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>You</div>
                        <div style={{
                          background: th.accent, color: "#fff",
                          borderRadius: "14px 4px 14px 14px", padding: "10px 14px",
                          maxWidth: "85%", fontSize: isMobile ? 14 : 15,
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {practiceLoading && conversation.length > 0 && (
                  <div style={{ color: th.textFaint, fontSize: 12, padding: "4px 8px" }}>…</div>
                )}
                <div ref={convEndRef} />
              </div>

              {/* Input */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendPracticeMessage()}
                  placeholder={`Reply in any language…`}
                  disabled={practiceLoading}
                  style={{
                    flex: 1, background: th.bgInput, border: `1.5px solid ${th.borderMid}`,
                    borderRadius: 12, padding: "11px 14px", fontSize: isMobile ? 15 : 14,
                    color: th.text, fontFamily: "inherit", outline: "none",
                  }}
                />
                <button onClick={startPracticeListening} style={{
                  background: practiceListening ? th.red + "22" : th.bgCard,
                  border: `1.5px solid ${practiceListening ? th.red : th.borderMid}`,
                  borderRadius: 12, padding: "11px 14px", fontSize: 15, cursor: "pointer",
                  color: practiceListening ? th.red : th.textMuted, lineHeight: 1, flexShrink: 0,
                }}>
                  {practiceListening ? "⏹" : "🎤"}
                </button>
                <button onClick={sendPracticeMessage} disabled={!userInput.trim() || practiceLoading} style={{
                  background: !userInput.trim() || practiceLoading ? th.bgCard : th.accent,
                  color: !userInput.trim() || practiceLoading ? th.textFaint : "#fff",
                  border: "none", borderRadius: 12, padding: "11px 18px",
                  fontSize: 12, fontFamily: "inherit", fontWeight: 600,
                  cursor: !userInput.trim() || practiceLoading ? "not-allowed" : "pointer", flexShrink: 0,
                }}>
                  Send
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
