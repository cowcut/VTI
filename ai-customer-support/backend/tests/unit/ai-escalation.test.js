const test = require("node:test");
const assert = require("node:assert/strict");

const { parseGeminiSupportReply } = require("../../dist/services/gemini.service.js");
const { shouldEscalateAiReply } = require("../../dist/services/ai-escalation.service.js");

test("Gemini parser keeps valid optional confidence and sentiment but ignores invalid metadata", () => {
  assert.deepEqual(
    parseGeminiSupportReply('{"reply":"Tôi sẽ kiểm tra giúp bạn.","requiresHuman":false,"confidence":0.72,"sentiment":"neutral"}'),
    { content: "Tôi sẽ kiểm tra giúp bạn.", requiresHuman: false, confidence: 0.72, sentiment: "neutral" },
  );
  assert.deepEqual(
    parseGeminiSupportReply('{"reply":"Xin chào","requiresHuman":false,"confidence":2,"sentiment":"unsafe"}'),
    { content: "Xin chào", requiresHuman: false },
  );
});

test("deterministic escalation handles explicit human requests and low-confidence negative replies", () => {
  assert.equal(shouldEscalateAiReply({ customerMessage: "Tôi muốn gặp nhân viên hỗ trợ", reply: { requiresHuman: false } }), true);
  assert.equal(shouldEscalateAiReply({ customerMessage: "Cảm ơn", reply: { requiresHuman: false, confidence: 0.35, sentiment: "positive" } }), true);
  assert.equal(shouldEscalateAiReply({ customerMessage: "Dịch vụ quá tệ", reply: { requiresHuman: false, confidence: 0.55, sentiment: "negative" } }), true);
  assert.equal(shouldEscalateAiReply({ customerMessage: "Cảm ơn", reply: { requiresHuman: false, confidence: 0.9, sentiment: "positive" } }), false);
});
