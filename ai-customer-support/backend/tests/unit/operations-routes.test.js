const test = require("node:test");
const assert = require("node:assert/strict");

const routes = require("../../dist/routes/operations.routes.js").default;
const { getOperationalTicketAnalytics } = require("../../dist/controllers/operations.controller.js");
const { Conversation } = require("../../dist/models/Conversation.model.js");

const endpoints = routes.stack
  .filter((layer) => layer.route)
  .flatMap((layer) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`));

const response = () => ({
  statusCode: 200,
  body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("operations API exposes an authenticated ticket analytics endpoint", () => {
  assert.ok(endpoints.includes("GET /tickets"));
});

test("operations analytics rejects non-admin users", async () => {
  const res = response();
  await getOperationalTicketAnalytics({ user: { role: "agent" } }, res, assert.fail);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /admin/i);
});

test("operations analytics returns aggregate counts without message contents", async () => {
  const originalAggregate = Conversation.aggregate;
  Conversation.aggregate = async () => [{
    openPending: [{ count: 2 }], overdueSla: [{ count: 1 }], firstResponseProxy: [{ count: 1 }],
    byCategory: [{ _id: "billing", count: 2 }], byPriority: [{ _id: "high", count: 1 }],
  }];
  const res = response();

  try {
    await getOperationalTicketAnalytics({ user: { role: "admin" } }, res, assert.fail);
  } finally {
    Conversation.aggregate = originalAggregate;
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.analytics, {
    openPending: 2, overdueSla: 1, firstResponseProxy: 1,
    byCategory: [{ category: "billing", count: 2 }], byPriority: [{ priority: "high", count: 1 }],
  });
  assert.doesNotMatch(JSON.stringify(res.body), /content/i);
});
