const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeTicketMetadata } = require("../../dist/services/ticket-management.service.js");

test("ticket metadata accepts a supported priority and category", () => {
  assert.deepEqual(
    normalizeTicketMetadata({ priority: "high", category: "technical" }),
    { priority: "high", category: "technical", routingKey: "technical" },
  );
});

test("ticket metadata rejects unsupported values and empty updates", () => {
  assert.throws(() => normalizeTicketMetadata({ priority: "immediate" }), /priority/i);
  assert.throws(() => normalizeTicketMetadata({ category: "sales" }), /category/i);
  assert.throws(() => normalizeTicketMetadata({}), /metadata/i);
});
