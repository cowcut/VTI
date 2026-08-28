const test = require("node:test");
const assert = require("node:assert/strict");

const { KnowledgeBaseArticle } = require("../../dist/models/KnowledgeBaseArticle.model.js");
const { KnowledgeBaseChunk } = require("../../dist/models/KnowledgeBaseChunk.model.js");

const {
  normalizeEmbedding,
  cosineSimilarity,
  embedTextWithGemini,
  findRelevantKnowledge,
  mergeHybridResults,
} = require("../../dist/services/knowledge-base.service.js");

test("embedding vectors are normalized and scored with cosine similarity", () => {
  assert.deepEqual(normalizeEmbedding([3, 4]), [0.6, 0.8]);
  assert.equal(cosineSimilarity([1, 0], [0.8, 0.6]), 0.8);
  assert.throws(() => normalizeEmbedding([0, 0]), /non-zero/);
  assert.throws(() => normalizeEmbedding([1, Number.NaN]), /finite/);
});

test("articles and document chunks reserve bounded normalized embedding storage", () => {
  for (const schema of [KnowledgeBaseArticle.schema, KnowledgeBaseChunk.schema]) {
    const embedding = schema.path("embedding");
    assert.ok(embedding);
    assert.equal(embedding.options.select, false);
  }
});

test("knowledge records remain valid before their first embedding reindex", async () => {
  const article = new KnowledgeBaseArticle({ title: "Refund", content: "Refund policy" });
  const chunk = new KnowledgeBaseChunk({ source: "507f1f77bcf86cd799439011", position: 0, content: "Refund policy" });
  await Promise.all([article.validate(), chunk.validate()]);
  assert.equal(article.embedding, undefined);
  assert.equal(chunk.embedding, undefined);
});

test("Gemini embeddings use the production endpoint and normalize successful responses", async () => {
  let request;
  const embedding = await embedTextWithGemini("refund policy", {
    apiKey: "test-key",
    timeoutMs: 50,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ embedding: { values: [3, 4] } }) };
    },
  });

  assert.deepEqual(embedding, [0.6, 0.8]);
  assert.match(request.url, /gemini-embedding-001:embedContent\?key=test-key/);
  assert.deepEqual(JSON.parse(request.options.body), {
    model: "models/gemini-embedding-001",
    content: { parts: [{ text: "refund policy" }] },
    outputDimensionality: 768,
  });
});

test("Gemini embedding failures return no vector so lexical retrieval can continue", async () => {
  const embedding = await embedTextWithGemini("refund policy", {
    apiKey: "test-key",
    timeoutMs: 50,
    fetchImpl: async () => { throw new Error("network unavailable"); },
  });
  assert.equal(embedding, null);
});

test("retrieval retains published lexical articles when Gemini embeddings are unavailable", async () => {
  const originalArticleFind = KnowledgeBaseArticle.find;
  const originalChunkFind = KnowledgeBaseChunk.find;
  const originalKey = process.env.GEMINI_API_KEY;
  const chain = (records) => ({ select() { return this; }, limit() { return this; }, populate() { return this; }, lean: async () => records });
  try {
    delete process.env.GEMINI_API_KEY;
    KnowledgeBaseArticle.find = () => chain([{ _id: { toString: () => "article-1" }, title: "Refund", content: "Refund policy", tags: ["refund"] }]);
    KnowledgeBaseChunk.find = () => chain([]);
    const result = await findRelevantKnowledge("refund policy");
    assert.deepEqual(result.map((item) => item.citation.sourceId), ["article-1"]);
    assert.equal(result[0].content, "Refund policy");
  } finally {
    KnowledgeBaseArticle.find = originalArticleFind;
    KnowledgeBaseChunk.find = originalChunkFind;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("hybrid ranking merges semantic and lexical candidates without duplicate citations", () => {
  const result = mergeHybridResults(
    [
      { title: "Refund", content: "lexical refund", tags: [], citation: { sourceId: "article-1", sourceType: "article", title: "Refund" } },
      { title: "Shipping", content: "lexical shipping", tags: [], citation: { sourceId: "article-2", sourceType: "article", title: "Shipping" } },
    ],
    [
      { title: "Refund", content: "semantic refund", tags: [], citation: { sourceId: "article-1", sourceType: "article", title: "Refund" }, score: 0.9 },
      { title: "Warranty", content: "semantic warranty", tags: [], citation: { sourceId: "article-3", sourceType: "article", title: "Warranty" }, score: 0.8 },
    ],
    3,
  );

  assert.deepEqual(result.map((item) => item.citation.sourceId), ["article-1", "article-3", "article-2"]);
  assert.equal(result[0].content, "semantic refund");
});
