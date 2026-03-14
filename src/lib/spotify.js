const CLIENT_ID = "203cbcdd4c3e46b0855adc8ec71294db";
const SCOPES = "user-read-currently-playing user-read-playback-state";
const REDIRECT_URI = () => {
  const origin = window.location.origin;
  // Spotify dashboard won't accept http://localhost — rewrite to 127.0.0.1
  if (origin.includes("localhost"))
    return origin.replace("localhost", "127.0.0.1");
  return origin;
};

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function generateRandomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

async function sha256(plain) {
  return await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
}

function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── Token storage (per user) ──────────────────────────────────────────────────
function tokenKey(userId) {
  return `wortschatz-spotify-${userId}`;
}

export function getTokens(userId) {
  try {
    return JSON.parse(localStorage.getItem(tokenKey(userId)));
  } catch {
    return null;
  }
}

function saveTokens(userId, tokens) {
  localStorage.setItem(
    tokenKey(userId),
    JSON.stringify({
      ...tokens,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    })
  );
}

export function clearTokens(userId) {
  localStorage.removeItem(tokenKey(userId));
}

export function isConnected(userId) {
  const t = getTokens(userId);
  return !!(t && t.access_token);
}

// ── Start OAuth PKCE flow ─────────────────────────────────────────────────────
export async function startAuth(userId) {
  const verifier = generateRandomString(64);
  sessionStorage.setItem("spotify_code_verifier", verifier);
  sessionStorage.setItem("spotify_auth_uid", userId);
  const challenge = base64urlEncode(await sha256(verifier));

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    show_dialog: "false",
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

// ── Handle OAuth callback (call on page load) ────────────────────────────────
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return null;

  const verifier = sessionStorage.getItem("spotify_code_verifier");
  const userId = sessionStorage.getItem("spotify_auth_uid");
  if (!verifier || !userId) return null;

  // Clean URL
  window.history.replaceState({}, "", window.location.pathname);
  sessionStorage.removeItem("spotify_code_verifier");
  sessionStorage.removeItem("spotify_auth_uid");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI(),
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error("Spotify token exchange failed:", await res.text());
    return null;
  }

  const tokens = await res.json();
  saveTokens(userId, tokens);
  return userId;
}

// ── Refresh token ─────────────────────────────────────────────────────────────
async function refreshAccessToken(userId) {
  const tokens = getTokens(userId);
  if (!tokens?.refresh_token) return false;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: CLIENT_ID,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    clearTokens(userId);
    return false;
  }

  const newTokens = await res.json();
  saveTokens(userId, { ...tokens, ...newTokens });
  return true;
}

// ── Authenticated Spotify API call with auto-refresh ──────────────────────────
async function spotifyFetch(userId, endpoint) {
  let tokens = getTokens(userId);
  if (!tokens) return null;

  // Refresh if expiring in < 60 seconds
  if (tokens.expiresAt && Date.now() > tokens.expiresAt - 60000) {
    const ok = await refreshAccessToken(userId);
    if (!ok) return null;
    tokens = getTokens(userId);
  }

  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (res.status === 401) {
    const ok = await refreshAccessToken(userId);
    if (!ok) return null;
    tokens = getTokens(userId);
    const retry = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!retry.ok) return null;
    return retry.status === 204 ? null : await retry.json();
  }

  if (res.status === 204) return null;
  if (!res.ok) return null;
  return await res.json();
}

// ── Get currently playing track ───────────────────────────────────────────────
export async function getCurrentlyPlaying(userId) {
  const data = await spotifyFetch(userId, "/me/player/currently-playing");
  if (!data || !data.item || data.currently_playing_type === "episode") return null;
  const track = data.item;
  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    albumArt:
      track.album.images?.[1]?.url || track.album.images?.[0]?.url || null,
    isPlaying: data.is_playing,
    progressMs: data.progress_ms,
    durationMs: track.duration_ms,
  };
}
