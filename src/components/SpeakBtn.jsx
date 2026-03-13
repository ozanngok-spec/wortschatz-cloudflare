import { useState } from "react";

export function SpeakBtn({ text, size = 13 }) {
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
