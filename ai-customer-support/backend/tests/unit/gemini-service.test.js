const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSupportPrompt,
  shouldGenerateAiReply,
} = require("../../dist/services/gemini.service.js");

test("AI replies are generated only for customer messages in AI mode", () => {
  assert.equal(shouldGenerateAiReply({ senderType: "customer", mode: "ai" }), true);
  assert.equal(shouldGenerateAiReply({ senderType: "customer", mode: "human" }), false);
  assert.equal(shouldGenerateAiReply({ senderType: "agent", mode: "ai" }), false);
});

test("Gemini prompt contains bounded conversation history and handoff instruction", () => {
  const prompt = buildSupportPrompt({
    subject: "Khó đăng nhập",
    messages: [
      { senderType: "customer", content: "Tôi không đăng nhập được." },
      { senderType: "agent", content: "Bạn thử đặt lại mật khẩu nhé." },
    ],
  });

  assert.match(prompt, /Khó đăng nhập/);
  assert.match(prompt, /Tôi không đăng nhập được/);
  assert.match(prompt, /không chắc chắn/i);
  assert.match(prompt, /không được bịa/i);
});

test("Gemini prompt includes only supplied published knowledge-base context", () => {
  const prompt = buildSupportPrompt({
    subject: "Khó đăng nhập",
    messages: [],
    knowledge: [{ title: "Đặt lại mật khẩu", content: "Dùng chức năng Quên mật khẩu.", tags: ["tài khoản"] }],
  });

  assert.match(prompt, /Knowledge Base/i);
  assert.match(prompt, /Đặt lại mật khẩu/);
  assert.match(prompt, /Quên mật khẩu/);
});
