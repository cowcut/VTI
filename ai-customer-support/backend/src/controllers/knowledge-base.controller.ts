import { NextFunction, Request, Response } from "express";
import { KnowledgeBaseArticle } from "../models/KnowledgeBaseArticle.model";
import { normalizeKnowledgeBaseInput } from "../services/knowledge-base.service";

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
