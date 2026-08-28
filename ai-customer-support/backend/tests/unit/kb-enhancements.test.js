const test = require("node:test");
const assert = require("node:assert/strict");

const routes = require("../../dist/routes/knowledge-base.routes.js").default;
const {
  buildFaqFallback,
  parseFaqDraft,
  sanitizeCitations,
  safeQueryTerms,
} = require("../../dist/services/knowledge-base-enhancements.service.js");

const endpoints = routes.stack
  .filter((layer) => layer.route)
  .flatMap((layer) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`));

test("FAQ draft parser and deterministic fallback always produce unpublished structured articles", () => {
  const fallback = buildFaqFallback("Đặt lại mật khẩu");
  assert.deepEqual(fallback, {
    title: "Câu hỏi thường gặp: Đặt lại mật khẩu",
    content: "## Câu hỏi\nLàm thế nào để Đặt lại mật khẩu?\n\n## Trả lời\nHãy kiểm tra hướng dẫn đã được xuất bản hoặc liên hệ đội hỗ trợ để được xác minh.\n\n## Khi nào cần hỗ trợ thêm\nNếu hướng dẫn không giải quyết được vấn đề, hãy tạo một yêu cầu hỗ trợ.",
    tags: ["đặt lại mật khẩu"],
    isPublished: false,
  });
  assert.deepEqual(parseFaqDraft('{"title":"FAQ","content":"Nội dung","tags":["Help"],"isPublished":true}'), {
    title: "FAQ", content: "Nội dung", tags: ["help"], isPublished: false,
  });
});

test("citations retain server references but only safe titles/types are prepared for UI", () => {
  const citations = sanitizeCitations([
    { sourceId: "507f1f77bcf86cd799439011", sourceType: "document", title: "Quy trình hoàn tiền" },
    { sourceId: "507f1f77bcf86cd799439012", sourceType: "article", title: "Đặt lại mật khẩu" },
  ]);
  assert.deepEqual(citations, [
    { sourceType: "document", title: "Quy trình hoàn tiền" },
    { sourceType: "article", title: "Đặt lại mật khẩu" },
  ]);
  assert.equal(JSON.stringify(citations).includes("507f"), false);
});

test("safe gap terms drop identifiers and customer message fragments", () => {
  assert.deepEqual(safeQueryTerms("Không đăng nhập được sau khi cập nhật ứng dụng"), ["không", "đăng", "nhập", "được", "sau", "khi"]);
  assert.deepEqual(safeQueryTerms("Email lan@example.com, đơn DH-100001"), []);
});

test("KB enhancement routes are explicitly admin-only endpoints", () => {
  assert.ok(endpoints.includes("POST /generate-faq"));
  assert.ok(endpoints.includes("DELETE /documents/:id"));
  assert.ok(endpoints.includes("GET /analytics"));
  for (const layer of routes.stack.filter((item) => item.route && ["/generate-faq", "/documents/:id", "/analytics"].includes(item.route.path))) {
    assert.equal(layer.route.stack.length, 3, `${layer.route.path} should include auth and admin middleware`);
  }
});
