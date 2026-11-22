/** Thin fetch wrapper used by every repository — mirrors mobile/lib/core/network/api_client.dart.
 *
 *  - Adds the JWT access token.
 *  - On a 401 swaps the refresh token for a new access token once (concurrent 401s share one refresh,
 *    because the server rotates refresh tokens) and replays the request.
 *  - The session is cleared only when the server rejects the refresh token itself (400/401).
 *  - Every failure becomes an ApiError whose message is ready to show in a toast. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any

export const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000/api/v1' : 'https://truflet.vercel.app/api/v1');

export class ApiError extends Error {
  status;
  data;
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
  toString() {
    return this.message;
  }
}

const ACCESS = 'access';
const REFRESH = 'refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  save(a, r) {
    localStorage.setItem(ACCESS, a);
    localStorage.setItem(REFRESH, r);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    tokens.onCleared?.();
  },
  onCleared: undefined,
};

let refreshing = null;

async function refresh() {
  try {
    const r = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (r.status === 400 || r.status === 401) {
      tokens.clear(); // refresh token expired / revoked
      return false;
    }
    if (!r.ok) return false;
    const data = await r.json();
    tokens.save(data.access, data.refresh ?? tokens.refresh);
    return true;
  } catch {
    return false;
  }
}

function query(params) {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function send(method, path, body, params, retried = false) {
  const headers = { Accept: 'application/json' };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const sentWith = tokens.access;
  if (sentWith) headers.Authorization = `Bearer ${sentWith}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}${query(params)}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach Turflet. Check your internet connection.");
  }
  if (res.status === 401 && tokens.refresh && !retried) {
    // another request already refreshed while this one was in flight → just replay it
    const alreadyFresh = tokens.access != null && tokens.access !== sentWith;
    const ok = alreadyFresh || (await (refreshing ??= refresh().finally(() => (refreshing = null))));
    if (ok) return send(method, path, body, params, true);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (data && typeof data === 'object' && data.message) throw new ApiError(String(data.message), res.status, data);
    throw new ApiError(`Something went wrong (${res.status}).`, res.status, data ?? undefined);
  }
  return data;
}

export const api = {
  get: (path, params) => send('GET', path, undefined, params),
  post: (path, body = {}) => send('POST', path, body),
  patch: (path, body) => send('PATCH', path, body),
  put: (path, body) => send('PUT', path, body),
  delete: (path) => send('DELETE', path),
};

export const asList = (v) => (Array.isArray(v) ? v : []);
export const asMap = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const errText = (e) => (e instanceof Error ? e.message : String(e));
