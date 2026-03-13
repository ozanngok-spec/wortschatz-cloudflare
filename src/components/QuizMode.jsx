import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../theme.js";
import { SpeakBtn } from "./SpeakBtn.jsx";
import { selectNextWord, buildRound } from "../lib/quiz.js";
import { matchesTypeFilter } from "../lib/helpers.js";

const QUIZ_TYPES = [
  { key: "all", label: "Alle", emoji: "🎲" },
  { key: "nomen", label: "Nomen", emoji: "📦" },
  { key: "verb", label: "Verben", emoji: "🏃" },
  { key: "ausdruck", label: "Ausdrücke", emoji: "💬" },
  { key: "adjektiv", label: "Adjektive", emoji: "🎨" },
  { key: "adverb", label: "Adverbien", emoji: "⚡" },
];

const TOTAL_ROUNDS = 10;

export function QuizMode({ words, onClose, onAnswer, reviewMap: reviewMapProp }) {
  const th = useTheme();
  const [quizFilter, setQuizFilter] = useState(null); // null = setup screen
  const [reviewMap, setReviewMap] = useState(() => reviewMapProp || {});
  const [round, setRound] = useState(null);
  const [roundNum, setRoundNum] = useState(0);
  const [selected, setSelected] = useState(null);
  const [fillInput, setFillInput] = useState("");
  const [fillChecked, setFillChecked] = useState(false);
  const [correct, setCorrect] = useState(null); // true/false after answer
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [finished, setFinished] = useState(false);
  const [history, setHistory] = useState([]); // {word, correct}
  const inputRef = useRef(null);

  const eligible = words.filter((w) => !w.mastered && (quizFilter === "all" || quizFilter === null || matchesTypeFilter(w, quizFilter)));

  // Generate next round
  const nextRound = useCallback(() => {
    if (roundNum >= TOTAL_ROUNDS) {
      setFinished(true);
      return;
    }
    // Try multiple words — buildRound can fail for some (e.g. fill-blank on expressions)
    const tried = new Set();
    for (let attempt = 0; attempt < eligible.length; attempt++) {
      const word = selectNextWord(
        eligible.filter((w) => !tried.has(w.id)),
        reviewMap
      );
      if (!word) break;
      tried.add(word.id);
      const r = buildRound(word, eligible);
      if (r) {
        setRound(r);
        setSelected(null);
        setFillInput("");
        setFillChecked(false);
        setCorrect(null);
        return;
      }
    }
    setFinished(true);
  }, [roundNum, eligible, reviewMap]);

  useEffect(() => {
    if (!finished && !round) nextRound();
  }, [round, finished, nextRound]);

  useEffect(() => {
    if (round?.type === "fill" && inputRef.current) inputRef.current.focus();
  }, [round]);

  const handleAnswer = (answer) => {
    if (correct !== null) return; // already answered

    const isCorrect =
      answer.trim().toLowerCase() === round.correctAnswer.trim().toLowerCase();
    setCorrect(isCorrect);
    setSelected(answer);

    // Update local review map (for spaced repetition ordering)
    const now = Date.now();
    const newMap = {
      ...reviewMap,
      [round.wordId]: {
        lastReviewed: now,
        correct: (reviewMap[round.wordId]?.correct || 0) + (isCorrect ? 1 : 0),
        total: (reviewMap[round.wordId]?.total || 0) + 1,
      },
    };
    setReviewMap(newMap);

    // Notify parent so word cards update their progress display (Supabase persistence)
    if (onAnswer) onAnswer(round.wordId, isCorrect);

    if (isCorrect) {
      setScore((s) => s + 1);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }

    const word = words.find((w) => w.id === round.wordId);
    setHistory((h) => [...h, { word: word?.word || "?", correct: isCorrect }]);

    // Auto-advance after delay
    setTimeout(
      () => {
        setRoundNum((n) => n + 1);
        setRound(null);
      },
      isCorrect ? 1000 : 2200
    );
  };

  const handleFillSubmit = () => {
    if (fillChecked || !fillInput.trim()) return;
    setFillChecked(true);
    handleAnswer(fillInput.trim());
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const overlay = {
    position: "fixed",
    inset: 0,
    background: th.isDark ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.5)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: 16,
  };

  const card = {
    background: th.bgCard,
    border: `1.5px solid ${th.border}`,
    borderRadius: 20,
    padding: th.isMobile ? "24px 20px 28px" : "32px 36px 36px",
    maxWidth: 480,
    width: "100%",
    fontFamily: "'Inter',system-ui,sans-serif",
    position: "relative",
    boxShadow: th.isDark
      ? "0 32px 80px rgba(0,0,0,0.6)"
      : "0 24px 80px rgba(0,0,0,0.15)",
  };

  // ── Setup screen (pick word type) ─────────────────────────────────────────
  if (quizFilter === null) {
    const countFor = (key) => {
      if (key === "all") return words.filter((w) => !w.mastered).length;
      return words.filter((w) => !w.mastered && matchesTypeFilter(w, key)).length;
    };
    return (
      <div style={overlay} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={card}>
          <button onClick={onClose} style={{ position:"absolute", top:14, right:16, background:"transparent", border:"none", color:th.textFaint, fontSize:20, cursor:"pointer", lineHeight:1 }}>×</button>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🧠</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: th.text, fontFamily: "'Lora',Georgia,serif" }}>Quiz starten</div>
            <div style={{ fontSize: 12, color: th.textMuted, marginTop: 4 }}>Welche Wörter möchtest du üben?</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {QUIZ_TYPES.map(({ key, label, emoji }) => {
              const count = countFor(key);
              const disabled = count < 4;
              return (
                <button
                  key={key}
                  onClick={() => !disabled && setQuizFilter(key)}
                  disabled={disabled}
                  style={{
                    background: disabled ? th.bgInset : th.bgInset,
                    border: `1.5px solid ${disabled ? th.border : th.borderMid}`,
                    borderRadius: 12,
                    padding: "14px 10px",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.4 : 1,
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.borderColor = th.accent; e.currentTarget.style.background = th.accentBg; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = disabled ? th.border : th.borderMid; e.currentTarget.style.background = th.bgInset; }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: disabled ? th.textFaint : th.text }}>{label}</div>
                  <div style={{ fontSize: 10, color: th.textFaint, marginTop: 2 }}>{count} Wörter</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: th.textFaint, textAlign: "center" }}>Mindestens 4 Wörter pro Kategorie nötig</div>
        </div>
      </div>
    );
  }

  // ── Finished screen ───────────────────────────────────────────────────────
  if (finished) {
    const pct = Math.round((score / Math.max(roundNum, 1)) * 100);
    const emoji = pct >= 80 ? "🎉" : pct >= 50 ? "💪" : "📚";
    return (
      <div style={overlay} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={card}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{emoji}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: th.text,
                marginBottom: 4,
                fontFamily: "'Lora',Georgia,serif",
              }}
            >
              {score}/{roundNum}
            </div>
            <div
              style={{
                fontSize: 13,
                color: th.textMuted,
                marginBottom: 20,
              }}
            >
              {pct}% richtig
              {bestStreak > 1 && (
                <span>
                  {" "}
                  · 🔥 Beste Serie: {bestStreak}
                </span>
              )}
            </div>

            {/* Round history */}
            <div
              style={{
                display: "flex",
                gap: 5,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 24,
              }}
            >
              {history.map((h, i) => (
                <div
                  key={i}
                  title={h.word}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    background: h.correct
                      ? th.isDark
                        ? "#0C2E18"
                        : "#D1FAE5"
                      : th.isDark
                        ? "#2E0C0C"
                        : "#FFE4E6",
                    color: h.correct ? th.green : th.red,
                    border: `1px solid ${h.correct ? th.green + "33" : th.red + "33"}`,
                  }}
                >
                  {h.correct ? "✓" : "✗"}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: `1px solid ${th.border}`,
                  borderRadius: 10,
                  color: th.textMuted,
                  fontSize: 12,
                  fontFamily: "inherit",
                  padding: "9px 20px",
                  cursor: "pointer",
                }}
              >
                Schließen
              </button>
              <button
                onClick={() => {
                  setRoundNum(0);
                  setScore(0);
                  setStreak(0);
                  setBestStreak(0);
                  setHistory([]);
                  setFinished(false);
                  setRound(null);
                  setQuizFilter(null);
                }}
                style={{
                  background: th.accent,
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: 600,
                  padding: "9px 20px",
                  cursor: "pointer",
                  boxShadow: `0 2px 10px ${th.accent}55`,
                }}
              >
                Nochmal spielen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading / not enough words ────────────────────────────────────────────
  if (!round) {
    return (
      <div style={overlay}>
        <div style={card}>
          <div
            style={{
              textAlign: "center",
              color: th.textMuted,
              fontSize: 13,
              padding: "20px 0",
            }}
          >
            {eligible.length < 4
              ? "Du brauchst mindestens 4 nicht-gelernte Wörter für das Quiz."
              : "Lade…"}
          </div>
          {eligible.length < 4 && (
            <div style={{ textAlign: "center" }}>
              <button
                onClick={onClose}
                style={{
                  background: th.accent,
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: 600,
                  padding: "9px 20px",
                  cursor: "pointer",
                }}
              >
                Zurück
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Active round ──────────────────────────────────────────────────────────
  const progressPct = (roundNum / TOTAL_ROUNDS) * 100;

  return (
    <div style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={card}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            background: "transparent",
            border: "none",
            color: th.textFaint,
            fontSize: 20,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Progress bar */}
        <div
          style={{
            height: 4,
            background: th.bgInset,
            borderRadius: 2,
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: th.accent,
              borderRadius: 2,
              transition: "width 0.4s ease",
            }}
          />
        </div>

        {/* Header info */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: th.textFaint,
              letterSpacing: "0.06em",
              fontWeight: 500,
            }}
          >
            Frage {roundNum + 1}/{TOTAL_ROUNDS}
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {streak >= 2 && (
              <span
                style={{
                  fontSize: 11,
                  color: "#F59E0B",
                  fontWeight: 600,
                }}
              >
                🔥 {streak}
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                color: th.green,
                fontWeight: 600,
              }}
            >
              {score}✓
            </span>
          </div>
        </div>

        {/* Round type label */}
        <div
          style={{
            fontSize: 10,
            color: th.textFaint,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          {round.type === "de-en" && "Deutsch → Englisch"}
          {round.type === "en-de" && "Englisch → Deutsch"}
          {round.type === "fill" && "Lückentext"}
        </div>

        {/* Prompt */}
        <div
          style={{
            fontSize: round.type === "fill" ? 16 : 24,
            fontFamily: "'Lora',Georgia,serif",
            fontWeight: 500,
            color: th.text,
            marginBottom: round.type === "fill" ? 8 : 4,
            lineHeight: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>{round.prompt}</span>
          {round.type === "de-en" && <SpeakBtn text={round.prompt} size={16} />}
        </div>

        {/* Hint for fill */}
        {round.type === "fill" && round.hint && (
          <div
            style={{
              fontSize: 12,
              color: th.textMuted,
              fontStyle: "italic",
              marginBottom: 16,
            }}
          >
            {round.hint}
          </div>
        )}

        {/* Multiple choice options */}
        {(round.type === "de-en" || round.type === "en-de") && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 20,
            }}
          >
            {round.options.map((opt, i) => {
              const isThis = selected === opt;
              const isCorrectOpt =
                opt.toLowerCase() === round.correctAnswer.toLowerCase();
              let bg = th.bgInset;
              let borderColor = th.border;
              let textColor = th.text;

              if (correct !== null) {
                if (isCorrectOpt) {
                  bg = th.isDark ? "#0C2E18" : "#D1FAE5";
                  borderColor = th.green;
                  textColor = th.green;
                } else if (isThis && !correct) {
                  bg = th.isDark ? "#2E0C0C" : "#FFE4E6";
                  borderColor = th.red;
                  textColor = th.red;
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  disabled={correct !== null}
                  style={{
                    background: bg,
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: 12,
                    padding: "14px 12px",
                    fontSize: 14,
                    fontFamily: round.type === "en-de" ? "'Lora',Georgia,serif" : "inherit",
                    color: textColor,
                    cursor: correct !== null ? "default" : "pointer",
                    textAlign: "center",
                    transition: "all 0.15s",
                    fontWeight: isCorrectOpt && correct !== null ? 600 : 400,
                    lineHeight: 1.4,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill-in-the-blank input */}
        {round.type === "fill" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={inputRef}
                value={fillInput}
                onChange={(e) => setFillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFillSubmit()}
                disabled={fillChecked}
                placeholder="Wort eingeben…"
                style={{
                  flex: 1,
                  background: th.bgInput,
                  border: `1.5px solid ${
                    fillChecked
                      ? correct
                        ? th.green
                        : th.red
                      : th.borderMid
                  }`,
                  borderRadius: 10,
                  padding: "11px 14px",
                  fontSize: 15,
                  color: th.text,
                  outline: "none",
                  fontFamily: "'Lora',Georgia,serif",
                }}
              />
              <button
                onClick={handleFillSubmit}
                disabled={fillChecked || !fillInput.trim()}
                style={{
                  background: th.accent,
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: 600,
                  padding: "11px 18px",
                  cursor:
                    fillChecked || !fillInput.trim()
                      ? "not-allowed"
                      : "pointer",
                  opacity: fillChecked || !fillInput.trim() ? 0.5 : 1,
                }}
              >
                Prüfen
              </button>
            </div>
            {fillChecked && !correct && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: th.textMuted,
                }}
              >
                Richtig wäre:{" "}
                <strong style={{ color: th.green }}>
                  {round.correctAnswer}
                </strong>
              </div>
            )}
          </div>
        )}

        {/* Feedback flash */}
        {correct !== null && (
          <div
            style={{
              marginTop: 16,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              color: correct ? th.green : th.red,
            }}
          >
            {correct
              ? streak >= 3
                ? `🔥 ${streak} in Folge!`
                : ["Richtig! 🎯", "Gut gemacht! ✨", "Perfekt! 💪"][
                    Math.floor(Math.random() * 3)
                  ]
              : "Nicht ganz 😕"}
          </div>
        )}
      </div>
    </div>
  );
}
