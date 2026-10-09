import { test } from "node:test";
import assert from "node:assert/strict";
import { accountProfileRetry, accountProfileRetryDelay } from "./account-profile-retry";

test("client retry policy: retries 5xx/network with backoff, not 4xx", () => {
  assert.equal(accountProfileRetry(0, { status: 500 }), true);
  assert.equal(accountProfileRetry(2, { status: 503 }), true);
  assert.equal(accountProfileRetry(3, { status: 500 }), false);
  assert.equal(accountProfileRetry(0, new TypeError("Failed to fetch")), true);
  assert.equal(accountProfileRetry(0, { status: 404 }), false);
  assert.equal(accountProfileRetry(0, { status: 403 }), false);
  assert.equal(accountProfileRetry(1, { status: 401 }), true);
  assert.equal(accountProfileRetry(2, { status: 401 }), false);
  assert.deepEqual([0, 1, 2, 3].map(accountProfileRetryDelay), [500, 1000, 2000, 2000]);
});
