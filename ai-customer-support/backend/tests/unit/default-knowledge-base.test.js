const test = require("node:test");
const assert = require("node:assert/strict");

const { defaultKnowledgeBaseArticles } = require("../../dist/services/default-knowledge-base.service.js");

test("default knowledge base provides safe published support guidance", () => {
  assert.ok(defaultKnowledgeBaseArticles.length >= 8);
  assert.ok(defaultKnowledgeBaseArticles.every((article) => article.isPublished));
  assert.equal(new Set(defaultKnowledgeBaseArticles.map((article) => article.title)).size, defaultKnowledgeBaseArticles.length);
  assert.ok(defaultKnowledgeBaseArticles.every((article) => article.tags.length));
});
