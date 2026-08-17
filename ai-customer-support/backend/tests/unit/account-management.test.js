const test = require("node:test");
const assert = require("node:assert/strict");

const { canManageAccount, normalizeAccountInput } = require("../../dist/services/account-management.service.js");

test("only admins can manage accounts and cannot suspend themselves", () => {
  assert.equal(canManageAccount({ role: "admin", id: "a1" }, { role: "agent", id: "u1", isActive: true }), true);
  assert.equal(canManageAccount({ role: "agent", id: "a2" }, { role: "customer", id: "u1", isActive: true }), false);
  assert.equal(canManageAccount({ role: "admin", id: "a1" }, { role: "admin", id: "a1", isActive: false }), false);
});

test("account input only accepts supported roles and active state", () => {
  assert.deepEqual(normalizeAccountInput({ name: "  Agent One  ", role: "agent", isActive: false }), { name: "Agent One", role: "agent", isActive: false });
  assert.throws(() => normalizeAccountInput({ role: "owner" }), /role/i);
  assert.throws(() => normalizeAccountInput({ isActive: "yes" }), /active/i);
});
