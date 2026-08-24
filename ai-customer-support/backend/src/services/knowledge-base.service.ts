import { KnowledgeBaseArticle } from "../models/KnowledgeBaseArticle.model";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeKnowledgeBaseInput = (input: Record<string, unknown>, partial = false) => {
  const article: Partial<{ title: string; content: string; tags: string[]; isPublished: boolean }> = {};
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

export const findRelevantKnowledge = async (query: string) => {
  const terms = query.trim().split(/\s+/).filter((term) => term.length > 2).slice(0, 8);
  if (!terms.length) return [];
  const matcher = new RegExp(terms.map(escapeRegex).join("|"), "i");
  return KnowledgeBaseArticle.find({ isPublished: true, $or: [{ title: matcher }, { content: matcher }, { tags: matcher }] })
    .select("title content tags")
    .limit(3)
    .lean();
};
