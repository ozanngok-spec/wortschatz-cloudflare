import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../theme.js";
import { startAuth, getCurrentlyPlaying, isConnected, clearTokens } from "../lib/spotify.js";
import { fetchLyrics } from "../lib/lyrics.js";
import { buildSpotifySource } from "../lib/helpers.js";

export function SpotifyPlayer({ userId, words, onSaveWord }) {
  const th = useTheme();
  const [connected, setConnected] = useState(false);
  const [track, setTrack] = useState(null);
  const [lyrics, setLyrics] = useState(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [vocabSuggestions, setVocabSuggestions] = useState([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [songLanguage, setSongLanguage] = useState(null);
  const [isGerman, setIsGerman] = useState(false);
  const [addingWord, setAddingWord] = useState(null);
  const lastTrackId = useRef(null);
  const pollRef = useRef(null);

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
    const current = await getCurrentlyPlaying(userId);
    setTrack(current);

    if (current && current.id !== lastTrackId.current) {
      lastTrackId.current = current.id;
      setLyrics(null);
      setVocabSuggestions([]);
      setSongLanguage(null);
      setIsGerman(false);
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
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const lang = data.language || null;
          const noText = lang && /instrumental|klassik|classical/i.test(lang);
          setSongLanguage(noText ? null : lang);
          setIsGerman(noText ? false : !!data.isGerman);
        }
      } catch (e) { console.error("Language detection failed:", e); }
      setVocabLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!connected) return;
    pollNowPlaying();
    pollRef.current = setInterval(pollNowPlaying, 5000);
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

  const handleFetchLyrics = async () => {
    if (!track || lyricsLoading || lyrics) { setLyricsOpen(o => !o); return; }
    setLyricsLoading(true);
    const lyr = await fetchLyrics(track.name, track.artist);
    setLyrics(lyr);
    setLyricsOpen(true);

    // If German and lyrics found, extract vocab
    if (isGerman && lyr?.plainLyrics) {
      setVocabLoading(true);
      try {
        const res = await fetch("/spotify-vocab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: track.name, artist: track.artist, lyrics: lyr.plainLyrics.slice(0, 3000) }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.isGerman) setVocabSuggestions(data.words || []);
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
            <div style={{ fontSize: 12, color: th.textMuted }}>Verbinde Spotify, um Vokabeln aus deinen Songs zu lernen</div>
          </div>
          <button onClick={handleConnect} style={{ background: spotifyGreen, color: "#fff", border: "none", borderRadius: 999, padding: "8px 18px", fontSize: 12, fontFamily: "inherit", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", boxShadow: `0 2px 12px ${spotifyGreen}55`, flexShrink: 0 }}>
            Verbinden
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
            Spotify {track?.isPlaying ? "· Läuft" : track ? "· Pausiert" : ""}
          </div>
          <button onClick={handleDisconnect} style={{ background: "transparent", border: `1px solid ${th.border}`, borderRadius: 6, color: th.textFaint, fontSize: 10, fontFamily: "inherit", padding: "3px 8px", cursor: "pointer" }}>Trennen</button>
        </div>

        {/* Nothing playing */}
        {!track && (
          <div style={{ color: th.textMuted, fontSize: 12, fontStyle: "italic", padding: "8px 0" }}>Spiele etwas auf Spotify ab…</div>
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
                  {!isGerman && (
                    <span style={{ fontSize: 11, color: th.textFaint }}>Vokabeln nur aus deutschen Songs</span>
                  )}
                </div>
              );
            })()}

            {/* Lyrics toggle */}
            {track && (
              <div style={{ marginTop: 12 }}>
                <button onClick={handleFetchLyrics} disabled={lyricsLoading} style={{ background: "transparent", border: "none", color: th.textMuted, fontSize: 11, fontFamily: "inherit", cursor: lyricsLoading ? "wait" : "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  {lyricsLoading ? (
                    <><span style={{ display: "inline-block", animation: "sp-spin 1s linear infinite" }}>⟳</span> Songtext wird geladen…</>
                  ) : (
                    <><span style={{ display: "inline-block", transform: lyricsOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", fontSize: 10 }}>▾</span> Songtext</>
                  )}
                </button>
                {lyricsOpen && lyrics?.plainLyrics && (
                  <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto", padding: "10px 14px", background: th.bgInset, borderRadius: 10, border: `1px solid ${th.border}`, fontSize: 12, color: th.textMuted, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "'Lora',Georgia,serif" }}>
                    {lyrics.plainLyrics}
                  </div>
                )}
                {lyricsOpen && lyrics && !lyrics.plainLyrics && (
                  <div style={{ marginTop: 8, fontSize: 11, color: th.textFaint, fontStyle: "italic" }}>Kein Songtext gefunden</div>
                )}
                {lyricsOpen && lyrics === null && !lyricsLoading && (
                  <div style={{ marginTop: 8, fontSize: 11, color: th.textFaint, fontStyle: "italic" }}>Kein Songtext gefunden</div>
                )}
              </div>
            )}

            {/* Vocab loading */}
            {vocabLoading && (
              <div style={{ marginTop: 14, fontSize: 11, color: th.textFaint, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", animation: "sp-spin 1s linear infinite" }}>⟳</span>
                Vokabeln werden extrahiert…
              </div>
            )}

            {/* Vocab chips */}
            {vocabSuggestions.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: th.textFaint, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Vokabeln aus dem Song</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {vocabSuggestions.map(v => {
                    const alreadyHave = words.some(w => w.word.toLowerCase() === v.word.toLowerCase());
                    const isAdding = addingWord === v.word;
                    return (
                      <button key={v.word} onClick={() => !alreadyHave && handleAddVocab(v.word)} disabled={alreadyHave || isAdding} title={v.translation}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: alreadyHave ? th.bgInset : th.accentBg, color: alreadyHave ? th.textFaint : th.accent, border: `1px solid ${alreadyHave ? th.border : th.accent + "44"}`, borderRadius: 999, padding: "4px 10px 4px 12px", fontSize: 11, fontFamily: "inherit", fontWeight: 500, cursor: alreadyHave ? "default" : "pointer", opacity: alreadyHave ? 0.5 : 1, transition: "all 0.15s" }}>
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
              <div style={{ marginTop: 12, fontSize: 11, color: th.textFaint, fontStyle: "italic" }}>Kein Songtext gefunden</div>
            )}
          </>
        )}
      </div>
      <style>{`
        @keyframes sp-pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes sp-spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>
    </div>
  );
}
