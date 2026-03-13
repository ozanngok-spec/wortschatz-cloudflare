export async function fetchExampleSentences(word) {
  const response = await fetch("/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
  if (!response.ok)
    throw new Error(`Proxy error ${response.status}: ${await response.text()}`);
  return await response.json();
}

export async function fetchPronunciationFeedback(targetWord, transcript) {
  const response = await fetch("/pronounce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word: targetWord, transcript }),
  });
  if (!response.ok) throw new Error(`Proxy error ${response.status}`);
  return await response.json();
}

export async function fetchWordOfTheDay() {
  const response = await fetch("/wotd");
  if (!response.ok) throw new Error(`WOTD error ${response.status}`);
  return await response.json();
}
