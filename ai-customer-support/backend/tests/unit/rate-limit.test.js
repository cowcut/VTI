const test = require("node:test");
const assert = require("node:assert/strict");

const { rateLimitPolicies } = require("../../dist/middleware/rate-limit.middleware.js");

test("public API rate limits protect authentication and Gemini-triggering messages", () => {
  assert.deepEqual(rateLimitPolicies.auth, { windowMs: 15 * 60 * 1000, limit: 10 });
  assert.deepEqual(rateLimitPolicies.register, { windowMs: 60 * 60 * 1000, limit: 5 });
  assert.deepEqual(rateLimitPolicies.message, { windowMs: 60 * 1000, limit: 15 });
});
