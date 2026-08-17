const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canAccessConversation,
  canManageConversation,
  conversationQuery,
} = require("../../dist/services/conversation-access.service.js");

const agent = { _id: { toString: () => "agent-1" }, role: "agent" };
const admin = { _id: { toString: () => "admin-1" }, role: "admin" };
const customer = { _id: { toString: () => "customer-1" }, role: "customer" };
const assigned = { customer: { toString: () => "customer-1" }, assignedAgent: { toString: () => "agent-1" } };
const unassigned = { customer: { toString: () => "customer-1" }, assignedAgent: null };

test("admins can access every conversation", () => {
  assert.equal(canAccessConversation(assigned, admin), true);
  assert.equal(canManageConversation(assigned, admin), true);
});

test("agents only access tickets assigned to them or unassigned tickets", () => {
  assert.equal(canAccessConversation(assigned, agent), true);
  assert.equal(canAccessConversation(unassigned, agent), true);
  assert.equal(canAccessConversation({ ...assigned, assignedAgent: { toString: () => "other-agent" } }, agent), false);
});

test("customers only access their own conversations", () => {
  assert.equal(canAccessConversation(assigned, customer), true);
  assert.equal(canAccessConversation({ ...assigned, customer: { toString: () => "other-customer" } }, customer), false);
});

test("conversation queries constrain agent visibility", () => {
  assert.deepEqual(conversationQuery(agent), { $or: [{ assignedAgent: agent._id }, { assignedAgent: null }] });
  assert.deepEqual(conversationQuery(customer), { customer: customer._id });
  assert.deepEqual(conversationQuery(admin), {});
});
