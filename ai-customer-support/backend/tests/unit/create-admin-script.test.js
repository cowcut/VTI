const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

const result = spawnSync("node", ["dist/scripts/create-admin.js"], {
  cwd: __dirname + "/../..",
  env: { ...process.env, MONGODB_URI: "mongodb://127.0.0.1:1/invalid" },
  encoding: "utf8",
});

test("admin seed script refuses to run without credentials", () => {
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ADMIN_EMAIL and ADMIN_PASSWORD are required/);
});
