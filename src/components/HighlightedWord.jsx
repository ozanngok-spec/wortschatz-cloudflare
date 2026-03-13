export function HighlightedWord({ word, highlights }) {
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
