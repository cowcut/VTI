const test = require("node:test");
const assert = require("node:assert/strict");

const routes = require("../../dist/routes/conversation.routes.js").default;

const endpoints = routes.stack
  .filter((layer) => layer.route)
  .flatMap((layer) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`));

test("conversation API exposes handoff and status endpoints", () => {
  assert.ok(endpoints.includes("PATCH /:id/status"));
  assert.ok(endpoints.includes("POST /:id/handoff"));
  assert.ok(endpoints.includes("PATCH /:id/metadata"));
  assert.ok(endpoints.includes("POST /:id/internal-notes"));
  assert.ok(endpoints.includes("POST /:id/ai-draft"));
  assert.ok(endpoints.includes("POST /:id/attachments"));
  assert.ok(endpoints.includes("GET /attachments/:messageId"));
});
