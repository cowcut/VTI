const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("agent claim accepts an empty POST body", () => {
  const controller = fs.readFileSync(path.join(__dirname, "../../src/controllers/conversation.controller.ts"), "utf8");
  assert.match(controller, /const requestedAgentId = \(req\.body \?\? \{\}\)\.assignedAgentId/);
});
