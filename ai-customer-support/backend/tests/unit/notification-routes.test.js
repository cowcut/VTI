const test = require("node:test");
const assert = require("node:assert/strict");

const routes = require("../../dist/routes/notification.routes.js").default;
const endpoints = routes.stack.filter((layer) => layer.route).flatMap((layer) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`));

test("notification API exposes authenticated list and read endpoints", () => {
  assert.ok(endpoints.includes("GET /"));
  assert.ok(endpoints.includes("PATCH /:id/read"));
  assert.ok(endpoints.includes("POST /read-all"));
});
