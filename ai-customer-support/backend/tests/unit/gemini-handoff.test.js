const test = require("node:test");
const assert = require("node:assert/strict");

const { parseGeminiSupportReply } = require("../../dist/services/gemini.service.js");

test("Gemini support reply parser extracts safe text and human-handoff signal", () => {
  assert.deepEqual(
    parseGeminiSupportReply('{"reply":"Tôi sẽ chuyển bạn đến nhân viên hỗ trợ.","requiresHuman":true}'),
    { content: "Tôi sẽ chuyển bạn đến nhân viên hỗ trợ.", requiresHuman: true },
  );
});

test("Gemini support reply parser rejects malformed or empty output", () => {
  assert.throws(() => parseGeminiSupportReply('not json'), /Gemini/i);
  assert.throws(() => parseGeminiSupportReply('{"reply":"","requiresHuman":false}'), /Gemini/i);
});
