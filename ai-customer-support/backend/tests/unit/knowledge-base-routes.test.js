const test = require("node:test");
const assert = require("node:assert/strict");

const routes = require("../../dist/routes/knowledge-base.routes.js").default;

const endpoints = routes.stack
  .filter((layer) => layer.route)
  .flatMap((layer) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`));

test("knowledge-base API exposes public read/search and admin CRUD endpoints", () => {
  assert.ok(endpoints.includes("GET /"));
  assert.ok(endpoints.includes("GET /search"));
  assert.ok(endpoints.includes("POST /"));
  assert.ok(endpoints.includes("PATCH /:id"));
  assert.ok(endpoints.includes("DELETE /:id"));
});
