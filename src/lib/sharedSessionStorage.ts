/**
 * Shared sessionStorage across tabs of the SAME browser.
 *
 * Behaviour:
 *  - Tokens live in `sessionStorage`, so closing the entire browser (last tab
 *    of the origin) ends the session and the next visit requires login.
 *  - New tabs / duplicated tabs receive the session from any still-open tab
 *    via `BroadcastChannel` (with a `localStorage`-event fallback), so users
 *    are NOT logged out when they open the app in another tab.
 *
 * API is intentionally the same shape as Web Storage so it can be used as
 * `storage` for `@supabase/supabase-js` and as a drop-in for our own token
 * helpers (`mkb_api_token`, `farmer_portal_token`, …).
 */

type Listener = () => void;

const CHANNEL_NAME = "mkb-session-sync";
const REQUEST_EVENT = "mkb:session:request";
const RESPONSE_EVENT = "mkb:session:response";
// Snapshot handoff via localStorage as a fallback when BroadcastChannel is not
// available (older Safari / private modes). The value is written+removed so it
// never persists across a full browser close.
const LS_REQUEST = "mkb:session:req";
const LS_RESPONSE = "mkb:session:resp";

const isBrowser = typeof window !== "undefined";

// A single instance shared per document.
let channel: BroadcastChannel | null = null;
if (isBrowser && typeof BroadcastChannel !== "undefined") {
  try { channel = new BroadcastChannel(CHANNEL_NAME); } catch { channel = null; }
}

function snapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isBrowser) return out;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      const v = sessionStorage.getItem(k);
      if (v != null) out[k] = v;
    }
  } catch { /* ignore */ }
  return out;
}

function applySnapshot(snap: Record<string, string>) {
  if (!isBrowser || !snap) return;
  try {
    for (const [k, v] of Object.entries(snap)) {
      if (sessionStorage.getItem(k) == null) sessionStorage.setItem(k, v);
    }
  } catch { /* ignore */ }
  listeners.forEach((fn) => { try { fn(); } catch { /* noop */ } });
}

const listeners = new Set<Listener>();

if (isBrowser) {
  // ── Respond to session-requests from newly opened tabs ─────────────
  const respond = () => {
    const snap = snapshot();
    if (Object.keys(snap).length === 0) return;
    if (channel) {
      try { channel.postMessage({ type: RESPONSE_EVENT, snap }); } catch { /* noop */ }
    }
    try {
      localStorage.setItem(LS_RESPONSE, JSON.stringify({ t: Date.now(), snap }));
      localStorage.removeItem(LS_RESPONSE);
    } catch { /* noop */ }
  };

  if (channel) {
    channel.addEventListener("message", (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === REQUEST_EVENT) respond();
      else if (msg.type === RESPONSE_EVENT && msg.snap) applySnapshot(msg.snap);
    });
  }

  window.addEventListener("storage", (e) => {
    if (e.key === LS_REQUEST && e.newValue) respond();
    if (e.key === LS_RESPONSE && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.snap) applySnapshot(parsed.snap);
      } catch { /* noop */ }
    }
  });

  // ── Ask other tabs for their session snapshot at startup ───────────
  const askForSession = () => {
    if (channel) {
      try { channel.postMessage({ type: REQUEST_EVENT }); } catch { /* noop */ }
    }
    try {
      localStorage.setItem(LS_REQUEST, String(Date.now()));
      localStorage.removeItem(LS_REQUEST);
    } catch { /* noop */ }
  };
  // Only ask if our sessionStorage is empty; otherwise we're already the
  // authoritative tab.
  try {
    if (sessionStorage.length === 0) askForSession();
  } catch { /* noop */ }
}

/**
 * Storage adapter compatible with the `Storage`-like interface expected by
 * `@supabase/supabase-js` (`getItem`, `setItem`, `removeItem`).
 */
export const sharedSessionStorage = {
  getItem(key: string): string | null {
    if (!isBrowser) return null;
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    if (!isBrowser) return;
    try { sessionStorage.setItem(key, value); } catch { /* noop */ }
    // Broadcast the individual change so other open tabs stay in sync.
    if (channel) {
      try { channel.postMessage({ type: RESPONSE_EVENT, snap: { [key]: value } }); } catch { /* noop */ }
    }
  },
  removeItem(key: string): void {
    if (!isBrowser) return;
    try { sessionStorage.removeItem(key); } catch { /* noop */ }
    if (channel) {
      try {
        channel.postMessage({ type: "mkb:session:remove", key });
      } catch { /* noop */ }
    }
  },
};

if (isBrowser && channel) {
  channel.addEventListener("message", (e: MessageEvent) => {
    const msg = e.data;
    if (msg?.type === "mkb:session:remove" && typeof msg.key === "string") {
      try { sessionStorage.removeItem(msg.key); } catch { /* noop */ }
      listeners.forEach((fn) => { try { fn(); } catch { /* noop */ } });
    }
  });
}

export function onSharedSessionChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
