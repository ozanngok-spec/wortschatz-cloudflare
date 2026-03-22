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

export async function testPush(userId, endpoint) {
  const response = await fetch("/push-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, endpoint }),
  });
  if (!response.ok) throw new Error(`Test push error ${response.status}`);
  return response.json();
}

export async function subscribePush(userId, subscription) {
  const response = await fetch("/push-subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, subscription }),
  });
  if (!response.ok) throw new Error(`Subscribe error ${response.status}`);
  return response.json();
}

export async function unsubscribePush(userId, endpoint) {
  const response = await fetch("/push-unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, endpoint }),
  });
  if (!response.ok) throw new Error(`Unsubscribe error ${response.status}`);
  return response.json();
}

export async function fetchWordOfTheDay(targetLanguage = "de", targetLevel = "B1", exclude = []) {
  const params = new URLSearchParams({ lang: targetLanguage, level: targetLevel });
  if (exclude.length > 0) params.set("exclude", exclude.join(","));
  const response = await fetch(`/wotd?${params}`);
  if (!response.ok) throw new Error(`WOTD error ${response.status}`);
  return await response.json();
}

export async function fetchTravelPhrases(category, targetLanguage = "de") {
  const response = await fetch("/travel-phrases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, targetLanguage }),
  });
  if (!response.ok) throw new Error(`Travel phrases error ${response.status}`);
  return await response.json();
}

export async function fetchTravelSituation(situation, targetLanguage = "de") {
  const response = await fetch("/travel-situation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ situation, targetLanguage }),
  });
  if (!response.ok) throw new Error(`Travel situation error ${response.status}`);
  return await response.json();
}

export async function fetchTravelRoleplay(scenario, messages, targetLanguage = "de", isOpening = false) {
  const response = await fetch("/travel-roleplay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, messages, targetLanguage, isOpening }),
  });
  if (!response.ok) throw new Error(`Travel roleplay error ${response.status}`);
  return await response.json();
}

export async function speakTravelTts(text) {
  const response = await fetch("/travel-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`TTS error ${response.status}`);
  return response.blob();
}
