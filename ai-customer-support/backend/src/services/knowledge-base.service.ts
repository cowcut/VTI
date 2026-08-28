import { KnowledgeBaseArticle } from "../models/KnowledgeBaseArticle.model";
import { KnowledgeBaseChunk } from "../models/KnowledgeBaseChunk.model";
import { KnowledgeBaseDocument } from "../models/KnowledgeBaseDocument.model";
import { KnowledgeBaseQueryMetric } from "../models/KnowledgeBaseQueryMetric.model";
import { KnowledgeCitation, safeQueryTerms } from "./knowledge-base-enhancements.service";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const generalConversationTerms = new Set(["xin", "chào", "bạn", "có", "thể", "hỗ", "trợ", "tôi", "như", "thế", "nào", "muốn", "hỏi", "về", "cảm", "ơn", "giúp", "mình", "vui", "lòng"]);

type KnowledgeInput = { title: string; content: string; tags?: string[]; isPublished?: boolean };
export type RetrievedKnowledge = { title: string; content: string; tags: string[]; citation: KnowledgeCitation };
type SemanticKnowledge = RetrievedKnowledge & { score: number };

export const mergeHybridResults = (lexical: RetrievedKnowledge[], semantic: SemanticKnowledge[], limit = 5): RetrievedKnowledge[] => {
  const ranked = new Map<string, { item: RetrievedKnowledge; score: number }>();
  semantic.forEach((item, index) => ranked.set(`${item.citation.sourceType}:${item.citation.sourceId}`, { item, score: item.score + (semantic.length - index) / 10_000 }));
  lexical.forEach((item, index) => {
    const key = `${item.citation.sourceType}:${item.citation.sourceId}`;
    const existing = ranked.get(key);
    const score = 0.25 + (lexical.length - index) / 10_000;
    if (!existing || score > existing.score) ranked.set(key, { item, score });
  });
  return [...ranked.values()].sort((left, right) => right.score - left.score).slice(0, limit).map(({ item }) => item);
};

export const normalizeEmbedding = (values: number[]) => {
  if (!values.length) throw new Error("Embedding must not be empty");
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Embedding values must be finite");
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) throw new Error("Embedding must be non-zero");
  return values.map((value) => value / magnitude);
};

export const cosineSimilarity = (left: number[], right: number[]) => {
  if (left.length !== right.length || !left.length) return 0;
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
};

type EmbeddingFetch = (url: string, init: RequestInit) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
type GeminiEmbeddingOptions = { apiKey?: string; timeoutMs?: number; fetchImpl?: EmbeddingFetch };

export const embedTextWithGemini = async (text: string, options: GeminiEmbeddingOptions = {}): Promise<number[] | null> => {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey || !text.trim()) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5_000);
  try {
    const fetchImpl = options.fetchImpl ?? (fetch as unknown as EmbeddingFetch);
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: text.trim() }] },
          outputDimensionality: 768,
        }),
      },
    );
    if (!response.ok) return null;
    const payload = await response.json() as { embedding?: { values?: unknown } };
    if (!Array.isArray(payload.embedding?.values) || !payload.embedding.values.every((value) => typeof value === "number")) return null;
    return normalizeEmbedding(payload.embedding.values);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const normalizeKnowledgeBaseInput = (input: Record<string, unknown>, partial = false) => {
  const article: Partial<KnowledgeInput> = {};
  for (const field of ["title", "content"] as const) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== "string" || !input[field].trim()) throw new Error(`${field} is required`);
      const limit = field === "title" ? 200 : 10_000;
      if (input[field].trim().length > limit) throw new Error(`${field} is too long`);
      article[field] = input[field].trim();
    } else if (!partial) throw new Error(`${field} is required`);
  }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.length > 20 || input.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 50)) throw new Error("tags are invalid");
    article.tags = [...new Set(input.tags.map((tag) => tag.trim().toLowerCase()))];
  }
  if (input.isPublished !== undefined) {
    if (typeof input.isPublished !== "boolean") throw new Error("isPublished must be boolean");
    article.isPublished = input.isPublished;
  }
  if (partial && !Object.keys(article).length) throw new Error("Article changes are required");
  return article;
};

export const normalizeKnowledgeDocumentInput = (input: Record<string, unknown>): KnowledgeInput => {
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 200) throw new Error("title is required");
  if (typeof input.content !== "string" || !input.content.trim() || input.content.trim().length > 50_000) throw new Error("content is too long");
  if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 20 || input.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 50))) throw new Error("tags are invalid");
  if (input.isPublished !== undefined && typeof input.isPublished !== "boolean") throw new Error("isPublished must be boolean");
  return { title: input.title.trim(), content: input.content.trim(), tags: input.tags ? [...new Set((input.tags as string[]).map((tag) => tag.trim().toLowerCase()))] : [], isPublished: input.isPublished as boolean | undefined };
};

export const chunkDocumentContent = (content: string, maxLength = 800, overlap = 120) => {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maxLength, normalized.length);
    if (end < normalized.length) {
      const breakAt = normalized.lastIndexOf(" ", end);
      if (breakAt > start) end = breakAt;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
};

export const knowledgeSearchTerms = (query: string) => (query.toLocaleLowerCase("vi-VN").match(/[\p{L}\p{N}-]+/gu) ?? [])
  .filter((term) => term.length > 1 && !generalConversationTerms.has(term))
  .slice(0, 8);

export const createKnowledgeDocumentWithChunks = async (input: KnowledgeInput) => {
  const document = await KnowledgeBaseDocument.create(input);
  const chunks = chunkDocumentContent(document.content).map((content, position) => ({ source: document._id, position, content }));
  if (chunks.length) await KnowledgeBaseChunk.insertMany(chunks);
  return { document, chunkCount: chunks.length };
};

export const findRelevantKnowledge = async (query: string) => {
  const terms = knowledgeSearchTerms(query);
  if (!terms.length) return [];
  const matcher = new RegExp(terms.map(escapeRegex).join("|"), "i");
  const lexicalPromise = Promise.all([
    KnowledgeBaseArticle.find({ isPublished: true, $or: [{ title: matcher }, { content: matcher }, { tags: matcher }] }).select("_id title content tags").limit(3).lean(),
    KnowledgeBaseChunk.find({ content: matcher }).populate({ path: "source", match: { isPublished: true, archivedAt: null }, select: "_id title tags" }).select("content source").limit(3).lean(),
  ]);
  const queryEmbedding = await embedTextWithGemini(query);
  const [articles, chunks] = await lexicalPromise;
  const lexical: RetrievedKnowledge[] = [
    ...articles.map((article) => ({ title: article.title, content: article.content.slice(0, 1200), tags: article.tags, citation: { sourceId: article._id.toString(), sourceType: "article" as const, title: article.title } })),
    ...chunks.flatMap((chunk) => {
      const source = chunk.source as unknown as { _id?: { toString(): string }; title?: string; tags?: string[] } | null;
      return source?.title && source._id ? [{ title: source.title, content: chunk.content.slice(0, 800), tags: source.tags ?? [], citation: { sourceId: source._id.toString(), sourceType: "document" as const, title: source.title } }] : [];
    }),
  ];
  if (!queryEmbedding) return lexical.slice(0, 5);

  const [embeddedArticles, embeddedChunks] = await Promise.all([
    KnowledgeBaseArticle.find({ isPublished: true, embedding: { $exists: true } }).select("_id title content tags +embedding").limit(40).lean(),
    KnowledgeBaseChunk.find({ embedding: { $exists: true } }).populate({ path: "source", match: { isPublished: true, archivedAt: null }, select: "_id title tags" }).select("content source +embedding").limit(60).lean(),
  ]);
  const semantic: SemanticKnowledge[] = [
    ...(embeddedArticles as unknown as Array<{ _id: { toString(): string }; title: string; content: string; tags: string[]; embedding?: number[] }>).flatMap((article) => {
      try {
        const score = cosineSimilarity(queryEmbedding, normalizeEmbedding(article.embedding ?? []));
        return score > 0.15 ? [{ title: article.title, content: article.content.slice(0, 1200), tags: article.tags, citation: { sourceId: article._id.toString(), sourceType: "article" as const, title: article.title }, score }] : [];
      } catch { return []; }
    }),
    ...(embeddedChunks as unknown as Array<{ content: string; embedding?: number[]; source: { _id?: { toString(): string }; title?: string; tags?: string[] } | null }>).flatMap((chunk) => {
      const source = chunk.source;
      if (!source?._id || !source.title) return [];
      try {
        const score = cosineSimilarity(queryEmbedding, normalizeEmbedding(chunk.embedding ?? []));
        return score > 0.15 ? [{ title: source.title, content: chunk.content.slice(0, 800), tags: source.tags ?? [], citation: { sourceId: source._id.toString(), sourceType: "document" as const, title: source.title }, score }] : [];
      } catch { return []; }
    }),
  ].sort((left, right) => right.score - left.score).slice(0, 5);
  return mergeHybridResults(lexical, semantic, 5);
};

export const recordKnowledgeGap = async (customerContent: string) => {
  const terms = safeQueryTerms(customerContent);
  if (terms.length < 2) return;
  await KnowledgeBaseQueryMetric.updateOne({ terms }, { $inc: { count: 1 }, $set: { lastSeenAt: new Date() } }, { upsert: true });
};
