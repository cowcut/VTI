const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const { Conversation } = require("../../dist/models/Conversation.model.js");
const { Message } = require("../../dist/models/Message.model.js");

test("Conversation defaults to an open AI conversation", async () => {
  const customerId = new mongoose.Types.ObjectId();
  const conversation = new Conversation({ customer: customerId });

  await conversation.validate();

  assert.equal(conversation.status, "open");
  assert.equal(conversation.mode, "ai");
  assert.equal(conversation.priority, "normal");
  assert.equal(conversation.category, "general");
  assert.equal(conversation.customer.toString(), customerId.toString());
});

test("Message requires content and supports customer sender", async () => {
  const conversationId = new mongoose.Types.ObjectId();
  const senderId = new mongoose.Types.ObjectId();
  const message = new Message({
    conversation: conversationId,
    sender: senderId,
    senderType: "customer",
    content: "Đơn hàng của tôi đang ở đâu?",
  });

  await message.validate();

  assert.equal(message.senderType, "customer");
  assert.equal(message.messageType, "text");
});

test("Message supports staff-only internal notes", async () => {
  const note = new Message({
    conversation: new mongoose.Types.ObjectId(),
    sender: new mongoose.Types.ObjectId(),
    senderType: "agent",
    messageType: "internal_note",
    content: "Khách cần xác minh thông tin trước khi hoàn tiền.",
  });

  await note.validate();
  assert.equal(note.messageType, "internal_note");
});
