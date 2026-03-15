import { useState } from "react";
import { DARK, LIGHT } from "../theme.js";
import { LANGUAGES } from "../lib/languages.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

const LEVELS = [
  { code: "A1", label: "Beginner",           desc: "Basic words and phrases" },
  { code: "A2", label: "Elementary",          desc: "Simple everyday expressions" },
  { code: "B1", label: "Intermediate",        desc: "Familiar topics, some complexity" },
  { code: "B2", label: "Upper-Intermediate",  desc: "Complex texts, fluent interaction" },
  { code: "C1", label: "Advanced",            desc: "Nuanced, idiomatic language" },
  { code: "C2", label: "Mastery",             desc: "Near-native proficiency" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

export function LanguageDashboard({ currentLang, currentLevel, onContinue, darkMode, toggleDark, asOverlay = false, onClose }) {
  const isMobile = useIsMobile();
  const th = { ...(darkMode ? DARK : LIGHT), isMobile };

  const [pickingLevelFor, setPickingLevelFor] = useState(null);
  const [editingLevel, setEditingLevel] = useState(false); // editing level of an existing language

  const getSavedLevel = (code) => localStorage.getItem(`wortschatz-level-${code}`) || null;

  const handleLangSelect = (code) => {
    if (code === currentLang && !editingLevel) {
      onContinue(code, currentLevel);
      return;
    }
    const saved = getSavedLevel(code);
    if (saved && !editingLevel) {
      onContinue(code, saved);
    } else {
      setPickingLevelFor(code);
      setEditingLevel(false);
    }
  };

  const handleLevelSelect = (level) => {
    onContinue(pickingLevelFor, level);
  };

  const currentLangConfig = LANGUAGES.find(l => l.code === currentLang);
  const otherLanguages = LANGUAGES.filter(l => l.code !== currentLang);

  const cardBase = {
    border: `1.5px solid ${th.border}`,
    borderRadius: 14,
    cursor: "pointer",
    transition: "all 0.15s",
    background: th.bgCard,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: isMobile ? "14px 8px" : "16px 10px",
    gap: 6,
    position: "relative",
  };

  // ── Level picker ─────────────────────────────────────────────────
  if (pickingLevelFor) {
    const lang = LANGUAGES.find(l => l.code === pickingLevelFor);
    return (
      <Wrapper th={th} asOverlay={asOverlay} onClose={onClose} darkMode={darkMode} toggleDark={toggleDark}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <button onClick={() => { setPickingLevelFor(null); setEditingLevel(false); }}
            style={{ background: "none", border: "none", color: th.textFaint, cursor: "pointer", fontSize: 13, padding: "0 0 20px", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
            ← Back
          </button>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{lang.flag}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: th.text, fontFamily: "'Lora',Georgia,serif" }}>{lang.name}</div>
            <div style={{ fontSize: 13, color: th.textMuted, marginTop: 4 }}>What's your level?</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {LEVELS.map(lv => {
              const saved = pickingLevelFor === currentLang ? currentLevel : getSavedLevel(pickingLevelFor);
              const active = saved === lv.code;
              return (
                <button key={lv.code} onClick={() => handleLevelSelect(lv.code)} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "13px 18px",
                  borderRadius: 12, border: `1.5px solid ${active ? th.accent : th.border}`,
                  background: active ? th.accent + "18" : th.bgCard,
                  cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit",
                  outline: "none", transition: "all 0.15s",
                }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: th.accent, minWidth: 28 }}>{lv.code}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: th.text }}>{lv.label}</div>
                    <div style={{ fontSize: 11, color: th.textFaint }}>{lv.desc}</div>
                  </div>
                  {active && <span style={{ marginLeft: "auto", color: th.accent, fontSize: 14 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </Wrapper>
    );
  }

  // ── Language grid ─────────────────────────────────────────────────
  return (
    <Wrapper th={th} asOverlay={asOverlay} onClose={onClose} darkMode={darkMode} toggleDark={toggleDark}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Greeting */}
        <div style={{ textAlign: "center", marginBottom: currentLangConfig ? 28 : 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: `1.5px solid ${th.accent}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 18, color: th.accent, fontFamily: "'Lora',Georgia,serif", fontStyle: "italic" }}>W</div>
          <h2 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 600, color: th.text, margin: "0 0 6px", fontFamily: "'Lora',Georgia,serif" }}>
            {currentLangConfig ? greeting() : "Welcome"}
          </h2>
          <p style={{ fontSize: 13, color: th.textMuted, margin: 0 }}>
            {currentLangConfig ? "What are you studying today?" : "Which language do you want to learn?"}
          </p>
        </div>

        {/* Current language — continue card */}
        {currentLangConfig && (
          <div style={{ marginBottom: 28 }}>
            <button onClick={() => onContinue(currentLang, currentLevel)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 16,
              background: `linear-gradient(135deg, ${th.accent}18, ${th.accent}08)`,
              border: `2px solid ${th.accent}55`, borderRadius: 16,
              padding: isMobile ? "16px 18px" : "18px 24px",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              boxShadow: `0 4px 24px ${th.accent}22`,
            }}>
              <span style={{ fontSize: isMobile ? 36 : 42 }}>{currentLangConfig.flag}</span>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: th.text }}>{currentLangConfig.name}</div>
                <div style={{ fontSize: 12, color: th.textMuted, marginTop: 2 }}>{currentLangConfig.nativeName}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: th.accent, background: th.accent + "22", borderRadius: 6, padding: "3px 9px", letterSpacing: "0.06em" }}>
                    {currentLevel}
                  </span>
                  <button onClick={e => { e.stopPropagation(); setPickingLevelFor(currentLang); setEditingLevel(true); }}
                    title="Change level"
                    style={{ background: "none", border: `1px solid ${th.border}`, borderRadius: 6, color: th.textFaint, fontSize: 10, cursor: "pointer", padding: "3px 7px", fontFamily: "inherit", lineHeight: 1 }}>
                    edit
                  </button>
                </div>
                <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: th.accent }}>
                  Continue →
                </span>
              </div>
            </button>
          </div>
        )}

        {/* Divider */}
        {currentLangConfig && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: th.border }} />
            <span style={{ fontSize: 11, color: th.textFaint, whiteSpace: "nowrap" }}>or switch language</span>
            <div style={{ flex: 1, height: 1, background: th.border }} />
          </div>
        )}

        {/* Language grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
          gap: 8,
        }}>
          {(currentLangConfig ? otherLanguages : LANGUAGES).map(lang => {
            const savedLevel = getSavedLevel(lang.code);
            return (
              <button key={lang.code} onClick={() => handleLangSelect(lang.code)} style={{
                ...cardBase,
                border: `1.5px solid ${th.border}`,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = th.accent + "66"; e.currentTarget.style.background = th.accent + "0a"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.background = th.bgCard; }}
              >
                <span style={{ fontSize: isMobile ? 26 : 30 }}>{lang.flag}</span>
                <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 600, color: th.text, textAlign: "center", lineHeight: 1.2, wordBreak: "break-word" }}>{lang.name}</div>
                {savedLevel
                  ? <span style={{ fontSize: 9, fontWeight: 700, color: th.accent, background: th.accent + "18", borderRadius: 4, padding: "1px 6px" }}>{savedLevel}</span>
                  : <span style={{ fontSize: 9, color: th.textFaint }}>new</span>
                }
              </button>
            );
          })}
        </div>

      </div>
    </Wrapper>
  );
}

// ── Shared wrapper (full-screen or overlay) ────────────────────────
function Wrapper({ th, asOverlay, onClose, darkMode, toggleDark, children }) {
  const isMobile = th.isMobile;

  const inner = (
    <div style={{
      minHeight: asOverlay ? "auto" : "100vh",
      background: th.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter',system-ui,sans-serif",
      padding: isMobile ? "64px 20px 32px" : "72px 24px 40px",
      transition: "background 0.3s",
    }}>
      {children}
    </div>
  );

  // Top-right controls — always fixed so they stay visible while scrolling
  const controls = (
    <div style={{ position: "fixed", top: 16, right: 20, display: "flex", gap: 8, alignItems: "center", zIndex: 60 }}>
      <button onClick={toggleDark} style={{ background: "transparent", border: `1px solid ${th.borderMid}`, borderRadius: 8, padding: "5px 10px", fontSize: 13, cursor: "pointer", color: th.textMuted, lineHeight: 1 }}>
        {darkMode ? "☀️" : "🌙"}
      </button>
      {asOverlay && onClose && (
        <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${th.borderMid}`, borderRadius: 8, padding: "5px 10px", fontSize: 13, cursor: "pointer", color: th.textMuted, lineHeight: 1 }}>
          ✕
        </button>
      )}
    </div>
  );

  if (asOverlay) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, background: th.bg, overflowY: "auto" }}>
        {controls}
        {inner}
      </div>
    );
  }

  return <>{controls}{inner}</>;
}
