const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("conversation model schema constructor has no stray URL token", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../src/models/Conversation.model.ts"), "utf8");
  assert.match(source, /new Schema<IConversation>\(\s*\{/);
  assert.doesNotMatch(source, /new Schema<IConversation>\(https?:\/\//);
});
