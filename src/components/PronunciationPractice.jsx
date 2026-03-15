import { useState, useRef } from "react";
import { useTheme } from "../theme.js";
import { fetchPronunciationFeedback } from "../lib/api.js";
import { HighlightedWord } from "./HighlightedWord.jsx";

export function PronunciationPractice({ word, speechLang = "de-DE", targetLanguage = "de" }) {
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
    if (!SR) { setFeedback("Speech recognition not supported. Please use Chrome."); setState("done"); return; }
    hasResultRef.current = false;
    setTranscript(""); setHighlights(null); setScore(null);
    const r = new SR();
    r.lang = speechLang; r.interimResults = true; r.maxAlternatives = 1;
    recognitionRef.current = r;
    r.onresult = async (e) => {
      const heard = Array.from(e.results).map(r=>r[0].transcript).join("");
      if (e.results[e.results.length-1].isFinal) {
        hasResultRef.current = true; setTranscript(heard); stopAudio(); setState("processing");
        try {
          const result = await fetchPronunciationFeedback(word, heard, targetLanguage);
          setFeedback(result.feedback); setScore(result.score); setHighlights(result.highlights);
        } catch(e) { setFeedback("Analysis failed. Please try again."); }
        setState("done");
      } else { setTranscript(heard); }
    };
    r.onerror = (e) => {
      stopAudio();
      if (e.error==="no-speech") setFeedback("No audio detected. Please speak louder.");
      else if (e.error==="not-allowed") setFeedback("Microphone access denied.");
      else setFeedback("Recording error. Please try again.");
      setState("done");
    };
    r.onend = () => { stopAudio(); if (!hasResultRef.current) { setFeedback("No audio detected. Please speak louder."); setState("done"); } };
    r.start(); setState("listening");
    await startVolumeMonitor();
    setTimeout(() => { if (!hasResultRef.current) { try { recognitionRef.current?.stop(); } catch(e) {} } }, 8000);
  };

  const stop = () => { try { recognitionRef.current?.stop(); } catch(e) {} stopAudio(); if (!hasResultRef.current) setState("idle"); };
  const reset = () => { setState("idle"); setFeedback(""); setTranscript(""); setScore(null); setHighlights(null); setVolume(0); };

  const bars = Array.from({ length:8 }, (_,i) => ({ h:6+i*3, active:volume>(i/8)*100 }));
  const scoreColor = score===null?th.textFaint:score>=75?th.green:score>=45?th.accent:th.red;
  const scoreLabel = score===null?"":score>=75?"Great!":score>=45?"Good, keep practicing!":"Keep practicing!";

  return (
    <div style={{ marginTop:14, padding:"14px 16px", background:th.bgInset, borderRadius:6, border:`1px solid ${th.border}` }}>
      <div style={{ fontSize:9, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:12 }}>Pronunciation practice</div>
      <div style={{ marginBottom:14, padding:"10px 14px", background:th.bgCard, borderRadius:6, border:`1px solid ${th.border}`, textAlign:"center" }}>
        <span style={{ color: state==="done" ? th.text : state==="listening" ? th.accent : th.textMuted, transition:"color 0.3s" }}>
          {state==="done" && highlights ? <HighlightedWord word={word} highlights={highlights} /> : <span style={{ fontSize:22, fontStyle:"italic" }}>{word}</span>}
        </span>
        {state==="done" && score!==null && <div style={{ marginTop:6, fontSize:11, color:scoreColor }}>{scoreLabel} ({score}/100)</div>}
        {state==="done" && highlights && (
          <div style={{ marginTop:8, display:"flex", gap:12, justifyContent:"center", fontSize:10 }}>
            <span style={{ color:th.green }}>● good</span>
            <span style={{ color:th.accent }}>● ok</span>
            <span style={{ color:th.red }}>● needs work</span>
          </div>
        )}
      </div>
      {state==="idle" && (
        <button onClick={start} style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:th.textMuted, fontSize:11, fontFamily:"inherit", padding:"5px 12px", cursor:"pointer" }}>
          🎤 Speak now
        </button>
      )}
      {state==="listening" && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:28 }}>
              {bars.map((b,i) => <div key={i} style={{ width:5, height:b.h, borderRadius:2, background:b.active?(volume>60?th.accent:"#7a9e6e"):th.border, transition:"background 0.08s" }} />)}
            </div>
            <span style={{ fontSize:12, color:th.textMuted }}>Recording…</span>
            <button onClick={stop} style={{ marginLeft:"auto", background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:th.red, fontSize:10, fontFamily:"inherit", padding:"3px 8px", cursor:"pointer" }}>⏹ Stop</button>
          </div>
          {transcript && <div style={{ fontSize:12, color:th.textMuted, fontStyle:"italic" }}>Heard: <span style={{ color:th.textWarm }}>{transcript}</span></div>}
          <div style={{ fontSize:10, color:th.textDim, marginTop:4 }}>Speak clearly — up to 8 seconds</div>
        </div>
      )}
      {state==="processing" && <div style={{ color:th.textMuted, fontSize:12 }}>Analysing pronunciation…</div>}
      {state==="done" && (
        <div>
          {transcript && <div style={{ fontSize:11, color:th.textFaint, marginBottom:8 }}>Heard: <em style={{ color:th.textMuted }}>„{transcript}"</em></div>}
          <div style={{ fontSize:13, color:th.textWarm, lineHeight:1.7, marginBottom:10 }}>{feedback}</div>
          <button onClick={reset} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:th.textMuted, fontSize:10, fontFamily:"inherit", padding:"3px 10px", cursor:"pointer" }}>⟳ Try again</button>
        </div>
      )}
    </div>
  );
}
