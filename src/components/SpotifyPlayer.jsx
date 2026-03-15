import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../theme.js";
import { startAuth, getCurrentlyPlaying, isConnected, clearTokens } from "../lib/spotify.js";
import { fetchLyrics } from "../lib/lyrics.js";
import { fetchExampleSentences } from "../lib/api.js";
import { buildSpotifySource } from "../lib/helpers.js";

function parseLrc(syncedLyrics) {
  return syncedLyrics
    .split("\n")
    .map(line => {
      const m = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
      if (!m) return null;
      return { timeMs: (parseInt(m[1]) * 60 + parseFloat(m[2])) * 1000, text: m[3].trim() };
    })
    .filter(l => l && l.text);
}

export function SpotifyPlayer({ userId, words, onSaveWord, onSaveWordData, targetLang = "de", targetLevel = "B1", uiLang }) {
  const th = useTheme();
  const s = (key, fallback) => uiLang?.strings?.[key] ?? fallback;
  const [connected, setConnected] = useState(false);
  const [track, setTrack] = useState(null);
  const [lyrics, setLyrics] = useState(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [vocabSuggestions, setVocabSuggestions] = useState([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [songLanguage, setSongLanguage] = useState(null);
  const [isTargetLanguage, setIsTargetLanguage] = useState(false);
  const [addingWord, setAddingWord] = useState(null);
  const [syncedLines, setSyncedLines] = useState(null);
  const [currentLineIdx, setCurrentLineIdx] = useState(-1);
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const [selectedWord, setSelectedWord] = useState(null); // word tapped in lyrics
  const [translationResult, setTranslationResult] = useState(null); // fetched AI data
  const [translationLoading, setTranslationLoading] = useState(false);
  const [addingFromLyrics, setAddingFromLyrics] = useState(false);
  const translationCache = useRef({}); // word → AI result
  const lastTrackId = useRef(null);
  const pollRef = useRef(null);
  const positionRef = useRef({ progressMs: 0, fetchedAt: 0, isPlaying: false });
  const syncTickRef = useRef(null);
  const currentLineRef = useRef(null);
  const syncedLinesRef = useRef(null); // mirror of syncedLines for tick (avoids state updater overhead)

  // Check connection when userId available
  useEffect(() => {
    if (userId) {
      setConnected(isConnected(userId));
      // Re-check after a short delay (in case OAuth callback is still processing)
      const t = setTimeout(() => setConnected(isConnected(userId)), 800);
      return () => clearTimeout(t);
    }
  }, [userId]);

  // Poll currently playing
  const pollNowPlaying = useCallback(async () => {
    if (!isConnected(userId)) { setConnected(false); return; }
    const fetchStart = Date.now();
    const current = await getCurrentlyPlaying(userId);
    setTrack(current);
    if (current) {
      // Bake in the full fetch duration so progressMs is already compensated for network RTT
      positionRef.current = { progressMs: current.progressMs + (Date.now() - fetchStart), fetchedAt: Date.now(), isPlaying: current.isPlaying };
    }

    if (current && current.id !== lastTrackId.current) {
      lastTrackId.current = current.id;
      setLyrics(null);
      setSyncedLines(null);
      syncedLinesRef.current = null;
      setCurrentLineIdx(-1);
      setVocabSuggestions([]);
      setSongLanguage(null);
      setIsTargetLanguage(false);
      setLyricsOpen(false);
      setLyricsLoading(false);

      // Detect language (without lyrics — just title/artist)
      setVocabLoading(true);
      try {
        const res = await fetch("/spotify-vocab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: current.name,
            artist: current.artist,
            lyrics: null,
            targetLanguage: targetLang,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const lang = data.language || null;
          const noText = lang && /instrumental|klassik|classical/i.test(lang);
          setSongLanguage(noText ? null : lang);
          setIsTargetLanguage(noText ? false : !!data.isTargetLanguage);
        }
      } catch (e) { console.error("Language detection failed:", e); }
      setVocabLoading(false);
    }
  }, [userId, targetLang]);

  useEffect(() => {
    if (!connected) return;
    pollNowPlaying();
    pollRef.current = setInterval(pollNowPlaying, 2000);
    return () => clearInterval(pollRef.current);
  }, [connected, pollNowPlaying]);

  const handleConnect = () => startAuth(userId);
  const handleDisconnect = () => {
    clearTokens(userId);
    setConnected(false);
    setTrack(null);
    setLyrics(null);
    setVocabSuggestions([]);
    setSongLanguage(null);
    lastTrackId.current = null;
  };

  // Sync tick — reads ref directly (no state updater overhead, no extra re-renders)
  useEffect(() => {
    syncTickRef.current = setInterval(() => {
      const lines = syncedLinesRef.current;
      if (!lines) return;
      const { progressMs, fetchedAt, isPlaying } = positionRef.current;
      if (!isPlaying) return;
      const now = progressMs + (Date.now() - fetchedAt); // offset already baked into progressMs at poll time
      const idx = lines.findLastIndex(l => l.timeMs <= now);
      setCurrentLineIdx(idx);
      if (idx >= 0) {
        const lineStart = lines[idx].timeMs;
        const lineEnd = idx + 1 < lines.length ? lines[idx + 1].timeMs : lineStart + 5000;
        const lineWords = lines[idx].text.split(/\s+/).filter(Boolean);
        const elapsed = Math.max(0, now - lineStart);
        const duration = Math.max(1, lineEnd - lineStart);
        setCurrentWordIdx(Math.min(Math.floor((elapsed / duration) * lineWords.length), lineWords.length - 1));
      }
    }, 100);
    return () => clearInterval(syncTickRef.current);
  }, []);

  // Auto-scroll current line into view
  useEffect(() => {
    currentLineRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentLineIdx]);

  const handleFetchLyrics = async () => {
    if (!track || lyricsLoading || lyrics) { setLyricsOpen(o => !o); return; }
    setLyricsLoading(true);
    const lyr = await fetchLyrics(track.name, track.artist);
    setLyrics(lyr);
    if (lyr?.syncedLyrics) { const parsed = parseLrc(lyr.syncedLyrics); syncedLinesRef.current = parsed; setSyncedLines(parsed); }
    setLyricsOpen(true);

    // If target language and lyrics found, extract vocab
    if (isTargetLanguage && lyr?.plainLyrics) {
      setVocabLoading(true);
      try {
        const res = await fetch("/spotify-vocab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: track.name, artist: track.artist, lyrics: lyr.plainLyrics.slice(0, 3000), targetLanguage: targetLang }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.isTargetLanguage) setVocabSuggestions(data.words || []);
        }
      } catch (e) { console.error("Vocab extraction failed:", e); }
      setVocabLoading(false);
    }
    setLyricsLoading(false);
  };

  const handleAddVocab = async (word) => {
    if (addingWord || words.some(w => w.word.toLowerCase() === word.toLowerCase())) return;
    setAddingWord(word);
    const source = track ? buildSpotifySource(track.name, track.artist) : null;
    try { await onSaveWord(word, source); } catch (e) { console.error(e); }
    setAddingWord(null);
  };

  const handleWordTap = (raw) => {
    const clean = raw.replace(/["""„''.,!?;:()[\]…–—]/g, "").trim();
    if (clean.length < 2) return;
    setSelectedWord(clean);
    setTranslationLoading(false);
    const key = clean.toLowerCase();
    // 1. Full cached result (best)
    if (translationCache.current[key]) {
      setTranslationResult(translationCache.current[key]);
      return;
    }
    // 2. Partial data from vocab suggestions batch (free, already fetched)
    const suggestion = vocabSuggestions.find(v => v.word.toLowerCase() === key);
    if (suggestion) {
      setTranslationResult({ word: suggestion.word, translation: suggestion.translation, type: suggestion.type, _partial: true });
      return;
    }
    setTranslationResult(null);
  };

  const handleTranslate = async () => {
    if (!selectedWord || translationLoading) return;
    const key = selectedWord.toLowerCase();
    if (translationCache.current[key]) {
      setTranslationResult(translationCache.current[key]);
      return;
    }
    setTranslationLoading(true);
    try {
      const ai = await fetchExampleSentences(selectedWord, targetLang, targetLevel);
      translationCache.current[key] = ai;
      setTranslationResult(ai);
    } catch (e) { console.error(e); }
    setTranslationLoading(false);
  };

  const handleAddFromLyrics = async () => {
    if (!selectedWord || addingFromLyrics) return;
    setAddingFromLyrics(true);
    const source = track ? buildSpotifySource(track.name, track.artist) : null;
    try {
      const cached = translationCache.current[selectedWord.toLowerCase()];
      if (cached && onSaveWordData) {
        await onSaveWordData(cached.word || selectedWord, cached, source);
      } else {
        await onSaveWord(selectedWord, source);
      }
    } catch (e) { console.error(e); }
    setAddingFromLyrics(false);
    setSelectedWord(null);
    setTranslationResult(null);
  };

  // Render a lyric line with tappable words and current-word highlight
  const renderLyricLine = (lineText, isCurrent) => {
    const tokens = lineText.split(/(\s+)/);
    let wordCount = 0;
    return tokens.map((token, ti) => {
      if (/^\s+$/.test(token)) return <span key={ti}>{token}</span>;
      const wi = wordCount++;
      const isCurrentWord = isCurrent && wi === currentWordIdx;
      const clean = token.replace(/["""„''.,!?;:()[\]…–—]/g, "").trim();
      const alreadyHave = clean.length > 1 && words.some(w => w.word.toLowerCase() === clean.toLowerCase());
      const isSuggested = !alreadyHave && clean.length > 1 && vocabSuggestions.some(v => v.word.toLowerCase() === clean.toLowerCase());
      return (
        <span key={ti} onClick={() => handleWordTap(token)}
          style={{
            cursor: "pointer", borderRadius: 3, padding: th.isMobile ? "2px 2px" : "0 1px",
            background: isCurrentWord ? th.accent : alreadyHave ? th.green + "33" : "transparent",
            color: isCurrentWord ? "#fff" : alreadyHave ? th.green : "inherit",
            fontWeight: isCurrentWord ? 700 : "inherit",
            transition: "background 0.15s",
            textDecoration: isCurrentWord ? "none" : alreadyHave ? "underline dotted" : isSuggested ? "underline" : "none",
            textDecorationColor: alreadyHave ? th.green : th.accent,
            textDecorationStyle: alreadyHave ? "dotted" : "dotted",
            textUnderlineOffset: "3px",
          }}>
          {token}
        </span>
      );
    });
  };

  const progressPct = track ? Math.round((track.progressMs / track.durationMs) * 100) : 0;
  const fmtTime = (ms) => { const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000); return `${m}:${s.toString().padStart(2, "0")}`; };

  const spotifyGreen = "#1DB954";

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div style={{ background: th.bgCard, border: `1.5px solid ${th.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: th.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>🎵 Spotify</div>
            <div style={{ fontSize: 12, color: th.textMuted }}>Connect Spotify to learn vocabulary from your songs</div>
          </div>
          <button onClick={handleConnect} style={{ background: spotifyGreen, color: "#fff", border: "none", borderRadius: 999, padding: "8px 18px", fontSize: 12, fontFamily: "inherit", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", boxShadow: `0 2px 12px ${spotifyGreen}55`, flexShrink: 0 }}>
            Connect
          </button>
        </div>
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  return (
    <div style={{ background: th.bgCard, border: `1.5px solid ${th.border}`, borderRadius: 14, marginBottom: 6, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: track ? 14 : 0 }}>
          <div style={{ fontSize: 10, color: spotifyGreen, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: spotifyGreen, display: "inline-block", animation: track?.isPlaying ? "sp-pulse 2s infinite" : "none" }} />
            Spotify {track?.isPlaying ? "· Playing" : track ? "· Paused" : ""}
          </div>
          <button onClick={handleDisconnect} style={{ background: "transparent", border: `1px solid ${th.border}`, borderRadius: 6, color: th.textFaint, fontSize: 10, fontFamily: "inherit", padding: "3px 8px", cursor: "pointer" }}>Disconnect</button>
        </div>

        {/* Nothing playing */}
        {!track && (
          <div style={{ color: th.textMuted, fontSize: 12, fontStyle: "italic", padding: "8px 0" }}>{s("spotifyIdle", "Play something on Spotify…")}</div>
        )}

        {track && (
          <>
            {/* Now Playing */}
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {track.albumArt && (
                <img src={track.albumArt} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: th.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
                <div style={{ fontSize: 12, color: th.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artist}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <div style={{ flex: 1, height: 3, background: th.border, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${progressPct}%`, height: "100%", background: spotifyGreen, borderRadius: 2, transition: "width 1s linear" }} />
                  </div>
                  <span style={{ fontSize: 10, color: th.textFaint, flexShrink: 0 }}>{fmtTime(track.progressMs)}</span>
                </div>
              </div>
            </div>

            {/* Language badge */}
            {songLanguage && (() => {
              const flagMap = {
                "deutsch":"🇩🇪", "german":"🇩🇪",
                "englisch":"🇬🇧", "english":"🇬🇧",
                "französisch":"🇫🇷", "french":"🇫🇷",
                "spanisch":"🇪🇸", "spanish":"🇪🇸",
                "italienisch":"🇮🇹", "italian":"🇮🇹",
                "portugiesisch":"🇧🇷", "portuguese":"🇧🇷",
                "türkisch":"🇹🇷", "turkish":"🇹🇷",
                "koreanisch":"🇰🇷", "korean":"🇰🇷",
                "japanisch":"🇯🇵", "japanese":"🇯🇵",
                "chinesisch":"🇨🇳", "chinese":"🇨🇳",
                "russisch":"🇷🇺", "russian":"🇷🇺",
                "arabisch":"🇸🇦", "arabic":"🇸🇦",
                "niederländisch":"🇳🇱", "dutch":"🇳🇱",
                "schwedisch":"🇸🇪", "swedish":"🇸🇪",
                "polnisch":"🇵🇱", "polish":"🇵🇱",
                "norwegisch":"🇳🇴", "norwegian":"🇳🇴",
                "dänisch":"🇩🇰", "danish":"🇩🇰",
                "finnisch":"🇫🇮", "finnish":"🇫🇮",
                "griechisch":"🇬🇷", "greek":"🇬🇷",
                "hindi":"🇮🇳",
                "hebräisch":"🇮🇱", "hebrew":"🇮🇱",
                "indonesisch":"🇮🇩", "indonesian":"🇮🇩",
                "thailändisch":"🇹🇭", "thai":"🇹🇭",
                "vietnamesisch":"🇻🇳", "vietnamese":"🇻🇳",
                "rumänisch":"🇷🇴", "romanian":"🇷🇴",
                "ungarisch":"🇭🇺", "hungarian":"🇭🇺",
                "tschechisch":"🇨🇿", "czech":"🇨🇿",
                "kroatisch":"🇭🇷", "croatian":"🇭🇷",
                "serbisch":"🇷🇸", "serbian":"🇷🇸",
              };
              const flag = flagMap[songLanguage.toLowerCase()] || "🌐";
              return (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span title={songLanguage} style={{ fontSize: 18, cursor: "default", lineHeight: 1 }}>{flag}</span>
                  {!isTargetLanguage && (
                    <span style={{ fontSize: 11, color: th.textFaint }}>Vocabulary only from songs in your target language</span>
                  )}
                </div>
              );
            })()}

            {/* Lyrics toggle */}
            {track && (
              <div style={{ marginTop: 12 }}>
                <button onClick={handleFetchLyrics} disabled={lyricsLoading} style={{ background: "transparent", border: "none", color: th.textMuted, fontSize: 11, fontFamily: "inherit", cursor: lyricsLoading ? "wait" : "pointer", padding: th.isMobile ? "8px 0" : "4px 0", display: "flex", alignItems: "center", gap: 4 }}>
                  {lyricsLoading ? (
                    <><span style={{ display: "inline-block", animation: "sp-spin 1s linear infinite" }}>⟳</span> Loading lyrics…</>
                  ) : (
                    <><span style={{ display: "inline-block", transform: lyricsOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", fontSize: 10 }}>▾</span> Lyrics</>
                  )}
                </button>
                {lyricsOpen && syncedLines && (
                  <div style={{ marginTop: 8, maxHeight: 260, overflowY: "auto", padding: "10px 4px", background: th.bgInset, borderRadius: 10, border: `1px solid ${th.border}` }}>
                    {syncedLines.map((line, i) => {
                      const isCurrent = i === currentLineIdx;
                      const isPast = i < currentLineIdx;
                      return (
                        <div key={i} ref={isCurrent ? currentLineRef : null} style={{
                          padding: th.isMobile ? (isCurrent ? "8px 14px" : "6px 14px") : (isCurrent ? "5px 14px" : "4px 14px"),
                          fontSize: isCurrent ? (th.isMobile ? 15 : 14) : (th.isMobile ? 13 : 12),
                          fontFamily: "'Lora',Georgia,serif",
                          color: isCurrent ? th.text : isPast ? th.textDim : th.textMuted,
                          lineHeight: 1.85,
                          transition: "color 0.3s, font-size 0.2s",
                          borderLeft: isCurrent ? `3px solid ${th.accent}` : "3px solid transparent",
                          background: isCurrent ? th.accent + "10" : "transparent",
                          borderRadius: isCurrent ? "0 6px 6px 0" : 0,
                        }}>
                          {renderLyricLine(line.text, isCurrent)}
                        </div>
                      );
                    })}
                  </div>
                )}
                {lyricsOpen && !syncedLines && lyrics?.plainLyrics && (
                  <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", padding: "10px 14px", background: th.bgInset, borderRadius: 10, border: `1px solid ${th.border}`, fontSize: 12, color: th.textMuted, lineHeight: 2, fontFamily: "'Lora',Georgia,serif" }}>
                    {lyrics.plainLyrics.split("\n").map((line, i) => (
                      <div key={i}>{line ? renderLyricLine(line, false) : <br />}</div>
                    ))}
                  </div>
                )}
                {lyricsOpen && lyrics && !lyrics.plainLyrics && (
                  <div style={{ marginTop: 8, fontSize: 11, color: th.textFaint, fontStyle: "italic" }}>No lyrics found</div>
                )}
                {lyricsOpen && lyrics === null && !lyricsLoading && (
                  <div style={{ marginTop: 8, fontSize: 11, color: th.textFaint, fontStyle: "italic" }}>No lyrics found</div>
                )}
              </div>
            )}

            {/* Vocab loading */}
            {vocabLoading && (
              <div style={{ marginTop: 14, fontSize: 11, color: th.textFaint, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", animation: "sp-spin 1s linear infinite" }}>⟳</span>
                Extracting vocabulary…
              </div>
            )}

            {/* Vocab chips */}
            {vocabSuggestions.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: th.textFaint, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Vocabulary from this song</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {vocabSuggestions.map(v => {
                    const alreadyHave = words.some(w => w.word.toLowerCase() === v.word.toLowerCase());
                    const isAdding = addingWord === v.word;
                    return (
                      <button key={v.word} onClick={() => !alreadyHave && handleAddVocab(v.word)} disabled={alreadyHave || isAdding} title={v.translation}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: alreadyHave ? th.bgInset : th.accentBg, color: alreadyHave ? th.textFaint : th.accent, border: `1px solid ${alreadyHave ? th.border : th.accent + "44"}`, borderRadius: 999, padding: th.isMobile ? "7px 12px 7px 14px" : "4px 10px 4px 12px", fontSize: 11, fontFamily: "inherit", fontWeight: 500, cursor: alreadyHave ? "default" : "pointer", opacity: alreadyHave ? 0.5 : 1, transition: "all 0.15s" }}>
                        {v.word}
                        {!alreadyHave && <span style={{ fontSize: 13, lineHeight: 1 }}>{isAdding ? "…" : "+"}</span>}
                        {alreadyHave && <span style={{ fontSize: 10 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No lyrics found */}
            {!vocabLoading && vocabSuggestions.length === 0 && !songLanguage && lyrics === null && track && (
              <div style={{ marginTop: 12, fontSize: 11, color: th.textFaint, fontStyle: "italic" }}>No lyrics found</div>
            )}
          </>
        )}
      </div>
      <style>{`
        @keyframes sp-pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes sp-spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes sp-slide-up { from { transform:translateY(100%) } to { transform:translateY(0) } }
      `}</style>

      {/* Word lookup popup */}
      {selectedWord && (() => {
        const alreadyHave = words.some(w => w.word.toLowerCase() === selectedWord.toLowerCase());
        const tr = translationResult;
        return (
          <>
            <div onClick={() => { setSelectedWord(null); setTranslationResult(null); }}
              style={{ position: "fixed", inset: 0, zIndex: 80 }} />
            <div style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
              background: th.bgCard, borderTop: `1.5px solid ${th.border}`,
              borderRadius: "18px 18px 0 0",
              padding: "16px 24px max(24px, env(safe-area-inset-bottom))",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
              animation: "sp-slide-up 0.22s ease-out",
              fontFamily: "'Inter',system-ui,sans-serif",
              maxHeight: "70vh", overflowY: "auto",
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: th.border, margin: "0 auto 16px" }} />

              {/* Word + close */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 22, fontFamily: "'Lora',Georgia,serif", fontWeight: 600, color: th.text }}>{tr?.word || selectedWord}</span>
                  {tr?.type && <span style={{ marginLeft: 8, fontSize: 11, color: th.textFaint, background: th.bgInset, borderRadius: 4, padding: "2px 7px" }}>{tr.type}</span>}
                  {tr?.level && <span style={{ marginLeft: 4, fontSize: 11, color: th.accent, fontWeight: 700 }}>{tr.level}</span>}
                </div>
                <button onClick={() => { setSelectedWord(null); setTranslationResult(null); }}
                  style={{ background: "transparent", border: "none", color: th.textFaint, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "6px 10px", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>

              {/* Translation result */}
              {tr && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 14, color: th.textMuted, marginBottom: 4 }}>{tr.translation}</div>
                  {tr.forms && <div style={{ fontSize: 12, color: th.textWarm, fontFamily: "'Lora',Georgia,serif", fontStyle: "italic", marginBottom: 6 }}>{tr.forms}</div>}
                  {tr.explanation && <div style={{ fontSize: 12, color: th.textWarm, fontFamily: "'Lora',Georgia,serif", fontStyle: "italic", lineHeight: 1.6 }}>{tr.explanation}</div>}
                </div>
              )}

              {/* Actions */}
              {alreadyHave ? (
                <div style={{ fontSize: 13, color: th.green, display: "flex", alignItems: "center", gap: 6, paddingBottom: 4 }}>✓ Already in your vocabulary</div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  {(!tr || tr._partial) && (
                    <button onClick={handleTranslate} disabled={translationLoading}
                      style={{ flex: 1, background: th.bgInset, color: translationLoading ? th.textFaint : th.textMuted, border: `1px solid ${th.border}`, borderRadius: 12, padding: "11px", fontSize: 13, fontFamily: "inherit", fontWeight: 500, cursor: translationLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {translationLoading
                        ? <><span style={{ display: "inline-block", animation: "sp-spin 1s linear infinite" }}>⟳</span> Loading…</>
                        : tr?._partial ? "🔍 More details" : "🔍 Translate"}
                    </button>
                  )}
                  <button onClick={handleAddFromLyrics} disabled={addingFromLyrics}
                    style={{ flex: 1, background: addingFromLyrics ? th.bgInset : th.accent, color: addingFromLyrics ? th.textFaint : "#fff", border: "none", borderRadius: 12, padding: "11px 18px", fontSize: 13, fontFamily: "inherit", fontWeight: 600, cursor: addingFromLyrics ? "wait" : "pointer", whiteSpace: "nowrap", boxShadow: addingFromLyrics ? "none" : `0 2px 12px ${th.accent}44` }}>
                    {addingFromLyrics ? "Adding…" : "+ Add to vocabulary"}
                  </button>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
