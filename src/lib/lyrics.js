export async function fetchLyrics(trackName, artistName) {
  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });

    const res = await fetch(`https://lrclib.net/api/search?${params}`);
    if (!res.ok) return null;

    const results = await res.json();
    if (!results || results.length === 0) return null;

    const best = results[0];
    return {
      plainLyrics: best.plainLyrics || null,
      syncedLyrics: best.syncedLyrics || null,
    };
  } catch (e) {
    console.error("Lyrics fetch failed:", e);
    return null;
  }
}
