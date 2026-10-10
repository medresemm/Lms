import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getFreshClerkToken, msUntilTokenExpiry, registerClerkTokenSource, type ClerkTokenSource } from "./clerk-token";

const jwt = (expSecondsFromNow: number, tag = "") => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow, tag })).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `h.${payload}.s`;
};

afterEach(() => registerClerkTokenSource(null, false));

test("reads JWT expiry", () => {
  const remaining = msUntilTokenExpiry(jwt(60));
  assert.ok(remaining !== null && remaining > 50_000);
  assert.equal(msUntilTokenExpiry("garbage"), null);
});

test("returns null and never asks Clerk when signed out", async () => {
  let calls = 0;
  registerClerkTokenSource(async () => { calls += 1; return "x"; }, false);
  assert.equal(await getFreshClerkToken(), null);
  assert.equal(calls, 0);
});

test("first token of a page load is force-refreshed once and shared, then the cache is used", async () => {
  const fresh = jwt(60, "fresh");
  const calls: Array<boolean> = [];
  const source: ClerkTokenSource = async (options) => { calls.push(Boolean(options?.skipCache)); return options?.skipCache ? fresh : jwt(60, "cached"); };
  registerClerkTokenSource(source, true);
  const [a, b] = await Promise.all([getFreshClerkToken(), getFreshClerkToken()]);
  assert.equal(a, fresh);
  assert.equal(b, fresh);
  assert.deepEqual(calls, [true]);
  await getFreshClerkToken();
  assert.deepEqual(calls, [true, false]);
});

test("a cached token about to expire is refreshed", async () => {
  const stale = jwt(2, "stale");
  let refreshes = 0;
  const source: ClerkTokenSource = async (options) => {
    if (options?.skipCache) { refreshes += 1; return jwt(60, `fresh${refreshes}`); }
    return stale;
  };
  registerClerkTokenSource(source, true);
  await getFreshClerkToken();
  const token = await getFreshClerkToken();
  assert.notEqual(token, stale);
  assert.equal(refreshes, 2);
});

test("forceRefresh always asks Clerk for a new token", async () => {
  let refreshes = 0;
  registerClerkTokenSource(async (options) => { if (options?.skipCache) refreshes += 1; return jwt(60, String(refreshes)); }, true);
  await getFreshClerkToken();
  await getFreshClerkToken({ forceRefresh: true });
  assert.equal(refreshes, 2);
});
