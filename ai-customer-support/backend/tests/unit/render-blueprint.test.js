const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const blueprintPath = path.resolve(__dirname, "../../../render.yaml");

test("Render Blueprint deploys a Node API and a static frontend without committed secrets", () => {
  const blueprint = fs.readFileSync(blueprintPath, "utf8");

  assert.match(blueprint, /runtime: node/);
  assert.match(blueprint, /healthCheckPath: \/api\/health/);
  assert.match(blueprint, /startCommand: npm --prefix backend run start/);
  assert.match(blueprint, /runtime: static/);
  assert.match(blueprint, /rootDir: ai-customer-support/);
  assert.match(blueprint, /staticPublishPath: ai-customer-support\/frontend\/dist/);
  assert.match(blueprint, /key: MONGODB_URI\s+sync: false/);
  assert.match(blueprint, /key: GEMINI_API_KEY\s+sync: false/);
  assert.match(blueprint, /key: JWT_SECRET\s+sync: false/);
  assert.match(blueprint, /key: VITE_API_BASE_URL\s+sync: false/);
  assert.doesNotMatch(blueprint, /mongodb\+srv:\/\//);
});
