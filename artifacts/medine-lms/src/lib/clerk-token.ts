/**
 * Single source of fresh Clerk session tokens for API calls.
 *
 * Why: the token Clerk keeps in memory (and the __session cookie) can already
 * be expired for a moment right after page load or after the tab wakes up —
 * Clerk refreshes it in the background on its own schedule. The very first
 * admin requests (/api/admin/exams, /api/messages/unread-count) are fired at
 * exactly that moment and were answered with 401. Here we
 *   - force one refresh (skipCache) for the first token of a page load,
 *   - refresh again whenever the cached token is about to expire,
 *   - share in-flight refreshes so parallel requests do not stampede Clerk,
 *   - and let callers force a refresh after an unexpected 401.
 */
export type ClerkTokenSource = (options?: { skipCache?: boolean }) => Promise<string | null>;

let source: ClerkTokenSource | null = null;
let signedIn = false;
let firstRefreshDone = false;
let inflightRefresh: Promise<string | null> | null = null;

const EXPIRY_MARGIN_MS = 15_000;
const TOKEN_TIMEOUT_MS = 8_000;

export function registerClerkTokenSource(next: ClerkTokenSource | null, isSignedIn: boolean) {
  if (!isSignedIn || next === null) {
    // New sign-in later must start with a fresh token again.
    firstRefreshDone = false;
    inflightRefresh = null;
  }
  source = next;
  signedIn = Boolean(next) && isSignedIn;
}

/** Milliseconds until the JWT expires (negative when expired); null when unreadable. */
export function msUntilTokenExpiry(token: string, now = Date.now()): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='))) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp * 1000 - now : null;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS); }),
  ]).finally(() => clearTimeout(timer));
}

function refresh(current: ClerkTokenSource): Promise<string | null> {
  if (!inflightRefresh) {
    inflightRefresh = withTimeout(current({ skipCache: true }))
      .then((token) => { if (token) firstRefreshDone = true; return token; })
      .catch(() => null)
      .finally(() => { inflightRefresh = null; });
  }
  return inflightRefresh;
}

/** A valid session token for the signed-in user, or null when signed out. */
export async function getFreshClerkToken(options: { forceRefresh?: boolean } = {}): Promise<string | null> {
  const current = source;
  if (!current || !signedIn) return null;
  if (options.forceRefresh || !firstRefreshDone) return refresh(current);
  try {
    const cached = await withTimeout(current());
    if (!cached) return refresh(current);
    const remaining = msUntilTokenExpiry(cached);
    return remaining !== null && remaining < EXPIRY_MARGIN_MS ? refresh(current) : cached;
  } catch {
    return refresh(current);
  }
}

/**
 * fetch() for hand-written API calls: attaches a fresh bearer token and, if the
 * server still answers 401 while we are signed in, retries once with a
 * force-refreshed token.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
  const token = await getFreshClerkToken();
  const response = await send(token);
  if (response.status !== 401 || !signedIn) return response;
  const retryToken = await getFreshClerkToken({ forceRefresh: true });
  return retryToken && retryToken !== token ? send(retryToken) : response;
}
