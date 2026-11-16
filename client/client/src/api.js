// Base URL for the OpsSync API. Override with VITE_API_URL in client/.env
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const TOKEN_KEY = "opssync.token";

// Storage can be unavailable (private mode, blocked site data) — never crash on it
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore; the session just won't survive a reload
  }
}

// fetch() that adds the login token and signals the app when the session ends
export async function authFetch(url, options = {}) {
  const token = getToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 401 && token) {
    window.dispatchEvent(new Event("opssync:unauthorized"));
  }

  return response;
}

// Fetch wrapper: sends JSON, throws on errors, and unwraps { data } payloads
export async function apiRequest(path, { method = "GET", body } = {}) {
  const response = await authFetch(`${API_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    // Non-JSON response; handled below
  }

  if (!response.ok || result?.success === false) {
    throw new Error(
      result?.message || `Request failed with status ${response.status}`
    );
  }

  if (Array.isArray(result)) return result;
  return result?.data ?? result;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

// ₹82.4L / ₹1.2Cr style amounts for summary cards
export function formatCompactCurrency(value) {
  const amount = value || 0;
  const abs = Math.abs(amount);

  if (abs >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(amount / 1e3).toFixed(1)}K`;
  return formatCurrency(amount);
}

export function formatDate(date, withTime = false) {
  if (!date) return "—";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (Number.isNaN(seconds)) return "";
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return formatDate(date);
}
