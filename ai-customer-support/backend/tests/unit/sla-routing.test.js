const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateSlaDeadline,
  routingKeyForCategory,
  normalizeTicketMetadata,
} = require("../../dist/services/ticket-management.service.js");

test("SLA deadline is deterministic for each priority", () => {
  const createdAt = new Date("2026-01-02T03:04:05.000Z");

  assert.equal(calculateSlaDeadline("urgent", createdAt).toISOString(), "2026-01-02T04:04:05.000Z");
  assert.equal(calculateSlaDeadline("high", createdAt).toISOString(), "2026-01-02T07:04:05.000Z");
  assert.equal(calculateSlaDeadline("normal", createdAt).toISOString(), "2026-01-03T03:04:05.000Z");
  assert.equal(calculateSlaDeadline("low", createdAt).toISOString(), "2026-01-05T03:04:05.000Z");
});

test("ticket metadata derives routing safely without assigning an agent", () => {
  assert.equal(routingKeyForCategory("technical"), "technical");
  assert.deepEqual(normalizeTicketMetadata({ category: "billing" }), {
    category: "billing",
    routingKey: "billing",
  });
  assert.deepEqual(normalizeTicketMetadata({ priority: "high" }), { priority: "high" });
});
