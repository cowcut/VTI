const test = require("node:test");
const assert = require("node:assert/strict");

const {
  chunkDocumentContent,
  knowledgeSearchTerms,
  normalizeKnowledgeDocumentInput,
} = require("../../dist/services/knowledge-base.service.js");
const { dispatchSupportTools } = require("../../dist/services/support-tools.service.js");

test("RAG document input is bounded and chunked deterministically", () => {
  const input = normalizeKnowledgeDocumentInput({
    title: "Quy trình giao hàng nội bộ",
    content: "Một hai ba bốn năm sáu bảy tám chín mười.",
    tags: ["Vận chuyển", "vận chuyển"],
  });
  assert.deepEqual(input.tags, ["vận chuyển"]);

  const chunks = chunkDocumentContent("abc def ghi jkl mno", 8, 2);
  assert.deepEqual(chunks, ["abc def", "ef ghi", "hi jkl", "kl mno"]);
  assert.ok(chunks.every((chunk) => chunk.length <= 8));
});

test("general greetings do not trigger irrelevant Knowledge Base retrieval", () => {
  assert.deepEqual(knowledgeSearchTerms("Xin chào, bạn có thể hỗ trợ tôi như thế nào?"), []);
  assert.deepEqual(knowledgeSearchTerms("Tôi muốn hỏi về hoàn tiền đơn hàng"), ["hoàn", "tiền", "đơn", "hàng"]);
});

test("simulated support tools only return safe known data explicitly supplied by customer", () => {
  const result = dispatchSupportTools("Kiểm tra đơn DH-100001 và email lan.nguyen@example.com giúp tôi.");
  assert.deepEqual(result, {
    order: { orderId: "DH-100001", status: "Đang giao", estimatedDelivery: "2026-08-27" },
    customer: { email: "lan.nguyen@example.com", name: "Lan Nguyễn", supportTier: "Tiêu chuẩn" },
  });
  assert.equal(dispatchSupportTools("Kiểm tra đơn DH-999999"), null);
  assert.equal(dispatchSupportTools("Kiểm tra đơn <script>DH-100001</script>"), null);
});
