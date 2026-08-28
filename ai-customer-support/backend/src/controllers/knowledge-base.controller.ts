import { NextFunction, Request, Response } from "express";
import { KnowledgeBaseArticle } from "../models/KnowledgeBaseArticle.model";
import { KnowledgeBaseChunk } from "../models/KnowledgeBaseChunk.model";
import { KnowledgeBaseDocument } from "../models/KnowledgeBaseDocument.model";
import { KnowledgeBaseQueryMetric } from "../models/KnowledgeBaseQueryMetric.model";
import { Message } from "../models/Message.model";
import { generateFaqDraft } from "../services/knowledge-base-enhancements.service";
import { createKnowledgeDocumentWithChunks, normalizeKnowledgeBaseInput, normalizeKnowledgeDocumentInput } from "../services/knowledge-base.service";

const validObjectId = (id: string) => /^[a-f\d]{24}$/i.test(id);

export const listPublishedArticles = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const articles = await KnowledgeBaseArticle.find({ isPublished: true }).select("title content tags updatedAt").sort({ updatedAt: -1 }).limit(100);
    return res.json({ success: true, articles });
  } catch (error) { return next(error); }
};

export const searchPublishedArticles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!query || query.length > 200) return res.status(400).json({ success: false, message: "Search query must be 1 to 200 characters" });
    const terms = query.split(/\s+/).filter((term) => term.length > 2).slice(0, 8).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!terms.length) return res.json({ success: true, articles: [] });
    const articles = await KnowledgeBaseArticle.find({ isPublished: true, $or: [{ title: new RegExp(terms.join("|"), "i") }, { content: new RegExp(terms.join("|"), "i") }, { tags: new RegExp(terms.join("|"), "i") }] }).select("title content tags updatedAt").limit(20);
    return res.json({ success: true, articles });
  } catch (error) { return next(error); }
};

export const createArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let input;
    try { input = normalizeKnowledgeBaseInput(req.body ?? {}); } catch (error) { return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid article" }); }
    const article = await KnowledgeBaseArticle.create(input);
    return res.status(201).json({ success: true, article });
  } catch (error) { return next(error); }
};

export const generateFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const draft = await generateFaqDraft(req.body?.topic);
    return res.json({ success: true, article: draft });
  } catch (error) { return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid FAQ topic" }); }
};

export const listKnowledgeDocuments = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const documents = await KnowledgeBaseDocument.aggregate([
      { $lookup: { from: KnowledgeBaseChunk.collection.name, localField: "_id", foreignField: "source", as: "chunks" } },
      { $addFields: { chunkCount: { $size: "$chunks" } } },
      { $project: { title: 1, tags: 1, isPublished: 1, archivedAt: 1, createdAt: 1, updatedAt: 1, chunkCount: 1 } },
      { $sort: { updatedAt: -1 } }, { $limit: 100 },
    ]);
    return res.json({ success: true, documents });
  } catch (error) { return next(error); }
};

export const createKnowledgeDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let input;
    try { input = normalizeKnowledgeDocumentInput(req.body ?? {}); } catch (error) { return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid internal document" }); }
    const result = await createKnowledgeDocumentWithChunks(input);
    return res.status(201).json({ success: true, document: result.document, chunkCount: result.chunkCount });
  } catch (error) { return next(error); }
};

export const archiveKnowledgeDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid document id" });
    const document = await KnowledgeBaseDocument.findByIdAndUpdate(req.params.id, { isPublished: false, archivedAt: new Date() }, { new: true });
    if (!document) return res.status(404).json({ success: false, message: "Document not found" });
    return res.status(200).json({ success: true, document });
  } catch (error) { return next(error); }
};

export const knowledgeBaseAnalytics = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [publishedArticles, publishedDocuments, chunkCount, gaps] = await Promise.all([
      KnowledgeBaseArticle.countDocuments({ isPublished: true }),
      KnowledgeBaseDocument.countDocuments({ isPublished: true, archivedAt: null }),
      KnowledgeBaseChunk.countDocuments(),
      KnowledgeBaseQueryMetric.find().sort({ count: -1, lastSeenAt: -1 }).limit(10).select("terms count lastSeenAt -_id").lean(),
    ]);
    // Citation counts are derived from AI metadata; only title/type are returned to the admin UI.
    const topCitedSourceTitles = await Message.aggregate([
      { $unwind: "$metadata.citations" },
      { $group: { _id: { title: "$metadata.citations.title", sourceType: "$metadata.citations.sourceType" }, count: { $sum: 1 } } },
      { $sort: { count: -1, "_id.title": 1 } }, { $limit: 10 },
      { $project: { _id: 0, title: "$_id.title", sourceType: "$_id.sourceType", count: 1 } },
    ]);
    return res.json({ success: true, analytics: { publishedArticles, publishedDocuments, chunkCount, topCitedSourceTitles, gapSuggestions: gaps.map((gap) => ({ terms: gap.terms, count: gap.count, lastSeenAt: gap.lastSeenAt })) } });
  } catch (error) { return next(error); }
};

export const updateArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid article id" });
    let input;
    try { input = normalizeKnowledgeBaseInput(req.body ?? {}, true); } catch (error) { return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid article changes" }); }
    const article = await KnowledgeBaseArticle.findByIdAndUpdate(req.params.id, input, { new: true, runValidators: true });
    if (!article) return res.status(404).json({ success: false, message: "Article not found" });
    return res.json({ success: true, article });
  } catch (error) { return next(error); }
};

export const deleteArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid article id" });
    const article = await KnowledgeBaseArticle.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: "Article not found" });
    return res.status(204).send();
  } catch (error) { return next(error); }
};
