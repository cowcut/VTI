const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSupportPrompt,
  GEMINI_REPLY_TIMEOUT_MS,
  generateGeminiReply,
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
  assert.match(prompt, /Dùng thông tin trong lịch sử hội thoại và Knowledge Base liên quan/i);
});

test("Gemini may answer safe general support questions without a Knowledge Base match", () => {
  const prompt = buildSupportPrompt({ subject: "Lời chào", messages: [{ senderType: "customer", content: "Xin chào" }] });

  assert.match(prompt, /có thể tự trả lời.*không cần Knowledge Base/i);
  assert.match(prompt, /không được bịa chính sách, trạng thái đơn hàng, dữ liệu tài khoản/i);
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

test("Gemini reserves enough output tokens for a complete structured support reply", async () => {
  let requestBody;
  const reply = await generateGeminiReply(
    { subject: "Kiểm tra", messages: [{ senderType: "customer", content: "Xin chào" }] },
    {
      apiKey: "test-key",
      model: "test-model",
      fetchImpl: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":"Chào bạn","requiresHuman":false}' }] } }] }), { status: 200 });
      },
    },
  );

  assert.equal(requestBody.generationConfig.maxOutputTokens, 1024);
  assert.deepEqual(reply, { content: "Chào bạn", requiresHuman: false });
});

test("Gemini reply generation allows enough time for a grounded production response", () => {
  assert.equal(GEMINI_REPLY_TIMEOUT_MS, 25_000);
});
