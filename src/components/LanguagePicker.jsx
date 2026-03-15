import { useState, useContext } from "react";
import { ThemeCtx } from "../theme.js";
import { LANGUAGES } from "../lib/languages.js";

const LEVELS = [
  { code: "A1", label: "A1 – Beginner", desc: "Basic words and phrases" },
  { code: "A2", label: "A2 – Elementary", desc: "Simple everyday expressions" },
  { code: "B1", label: "B1 – Intermediate", desc: "Familiar topics, some complexity" },
  { code: "B2", label: "B2 – Upper-Intermediate", desc: "Complex texts, fluent interaction" },
  { code: "C1", label: "C1 – Advanced", desc: "Nuanced, idiomatic language" },
  { code: "C2", label: "C2 – Mastery", desc: "Near-native proficiency" },
];

export function LanguagePicker({ current, currentLevel, onChange, onClose }) {
  const th = useContext(ThemeCtx);
  const [step, setStep] = useState("language"); // "language" | "level"
  const [selectedLang, setSelectedLang] = useState(current);

  const handleLangSelect = (code) => {
    setSelectedLang(code);
    setStep("level");
  };

  const handleLevelSelect = (level) => {
    onChange(selectedLang, level);
    onClose();
  };

  const btnStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
    borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
    background: active ? th.accent + "22" : th.bg,
    outline: active ? `2px solid ${th.accent}` : "none",
    color: th.text, width: "100%",
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: th.card, borderRadius: 16, padding: 24, width: "min(320px, calc(100vw - 32px))", maxHeight: "80vh",
        overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }} onClick={e => e.stopPropagation()}>

        {step === "language" ? (<>
          <div style={{ fontSize: 16, fontWeight: 700, color: th.text, marginBottom: 16 }}>
            Which language are you learning?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => handleLangSelect(lang.code)} style={btnStyle(current === lang.code)}>
                <span style={{ fontSize: 22 }}>{lang.flag}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{lang.name}</div>
                  <div style={{ fontSize: 11, color: th.textFaint }}>{lang.nativeName}</div>
                </div>
              </button>
            ))}
          </div>
        </>) : (<>
          <button onClick={() => setStep("language")} style={{ background: "none", border: "none", color: th.textFaint, cursor: "pointer", fontSize: 12, padding: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
            ← Back
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, color: th.text, marginBottom: 4 }}>
            What's your {LANGUAGES.find(l => l.code === selectedLang)?.name} level?
          </div>
          <div style={{ fontSize: 12, color: th.textFaint, marginBottom: 16 }}>
            This shapes vocabulary difficulty and explanations.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {LEVELS.map(lv => (
              <button key={lv.code} onClick={() => handleLevelSelect(lv.code)} style={btnStyle(currentLevel === lv.code && selectedLang === current)}>
                <div style={{ minWidth: 32, fontWeight: 700, fontSize: 14, color: th.accent }}>{lv.code}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{lv.label.split(" – ")[1]}</div>
                  <div style={{ fontSize: 11, color: th.textFaint }}>{lv.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </>)}
      </div>
    </div>
  );
}
