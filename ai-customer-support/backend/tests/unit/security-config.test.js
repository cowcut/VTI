const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getAllowedOrigins,
  getCorsOptions,
  isProduction,
} = require("../../dist/config/security.js");

test("security config parses a comma-separated frontend origin allowlist", () => {
  assert.deepEqual(
    getAllowedOrigins("https://app.example.com, https://staff.example.com"),
    ["https://app.example.com", "https://staff.example.com"],
  );
  assert.deepEqual(getAllowedOrigins("  "), []);
});

test("production CORS rejects missing allowlists and unknown browser origins", () => {
  assert.equal(isProduction("production"), true);
  assert.equal(isProduction("development"), false);
  assert.throws(() => getCorsOptions({ nodeEnv: "production", corsOrigins: "" }));

  const options = getCorsOptions({ nodeEnv: "production", corsOrigins: "https://app.example.com" });
  assert.equal(options.credentials, false);
  assert.equal(options.origin("https://app.example.com"), true);
  assert.equal(options.origin("https://attacker.example"), false);
});

test("development CORS permits local browser origins while server-to-server calls remain allowed", () => {
  const options = getCorsOptions({ nodeEnv: "development", corsOrigins: "" });
  assert.equal(options.origin(undefined), true);
  assert.equal(options.origin("http://127.0.0.1:5173"), true);
  assert.equal(options.origin("https://attacker.example"), false);
});
