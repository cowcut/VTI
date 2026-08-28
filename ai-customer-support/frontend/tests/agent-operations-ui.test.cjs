const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../src/App.tsx"), "utf8");

test("agent inbox has explicit operational queues", () => {
  assert.match(app, /type TicketQueue = 'all' \| 'unassigned' \| 'mine' \| 'overdue'/);
  assert.match(app, /ticketQueue === 'unassigned'/);
  assert.match(app, /ticketQueue === 'overdue'/);
});

test("admin can reassign an active ticket from the inbox", () => {
  assert.match(app, /assignedAgentId/);
  assert.match(app, /Gán Agent/);
});
