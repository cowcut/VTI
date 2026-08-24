const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../dist/app.js").default;

test("production app trusts its single Nginx proxy for rate-limit client IPs", () => {
  assert.equal(app.get("trust proxy"), 1);
});
