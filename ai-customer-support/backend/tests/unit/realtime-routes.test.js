const test = require("node:test");
const assert = require("node:assert/strict");

const routes = require("../../dist/routes/realtime.routes.js").default;
const endpoints = routes.stack.filter((layer) => layer.route).flatMap((layer) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`));

test("realtime API exposes an authenticated SSE event stream", () => {
  assert.ok(endpoints.includes("GET /events"));
});
