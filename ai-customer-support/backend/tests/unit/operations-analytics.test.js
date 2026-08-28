const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOperationalTicketAnalyticsPipeline,
  formatOperationalTicketAnalytics,
} = require("../../dist/services/operations-analytics.service.js");

test("operational analytics pipeline counts ticket state without customer content", () => {
  const pipeline = buildOperationalTicketAnalyticsPipeline(new Date("2026-01-02T03:04:05.000Z"));
  const serialized = JSON.stringify(pipeline);

  assert.match(serialized, /"open"/);
  assert.match(serialized, /"pending"/);
  assert.match(serialized, /slaDeadline/);
  assert.match(serialized, /senderType/);
  assert.doesNotMatch(serialized, /"content"/);
  assert.doesNotMatch(serialized, /customer.*email|email.*customer/i);
});

test("operational analytics formats only aggregate counts and breakdowns", () => {
  assert.deepEqual(formatOperationalTicketAnalytics([{ 
    openPending: [{ count: 5 }],
    overdueSla: [{ count: 2 }],
    firstResponseProxy: [{ count: 4 }],
    averageFirstResponseMinutes: [{ average: 12.5 }],
    byCategory: [{ _id: "technical", count: 3 }],
    byPriority: [{ _id: "high", count: 2 }],
  }]), {
    openPending: 5,
    overdueSla: 2,
    firstResponseProxy: 4,
    averageFirstResponseMinutes: 12.5,
    byCategory: [{ category: "technical", count: 3 }],
    byPriority: [{ priority: "high", count: 2 }],
  });
});
