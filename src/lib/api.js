export async function fetchExampleSentences(word, targetLanguage = "de", targetLevel = "B1") {
  const response = await fetch("/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, targetLanguage, targetLevel }),
  });
  if (!response.ok)
    throw new Error(`Proxy error ${response.status}: ${await response.text()}`);
  return await response.json();
}

export async function fetchPronunciationFeedback(targetWord, transcript, targetLanguage = "de") {
  const response = await fetch("/pronounce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word: targetWord, transcript, targetLanguage }),
  });
  if (!response.ok) throw new Error(`Proxy error ${response.status}`);
  return await response.json();
}

export async function fetchWordOfTheDay(targetLanguage = "de", targetLevel = "B1") {
  const response = await fetch(`/wotd?lang=${targetLanguage}&level=${targetLevel}`);
  if (!response.ok) throw new Error(`WOTD error ${response.status}`);
  return await response.json();
}
