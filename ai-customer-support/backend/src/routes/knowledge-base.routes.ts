import { Router } from "express";
import { archiveKnowledgeDocument, createArticle, createKnowledgeDocument, deleteArticle, generateFaq, knowledgeBaseAnalytics, listKnowledgeDocuments, listPublishedArticles, searchPublishedArticles, updateArticle } from "../controllers/knowledge-base.controller";
import { protect } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";

const router = Router();

router.get("/", listPublishedArticles);
router.get("/search", searchPublishedArticles);
router.post("/generate-faq", protect, requireAdmin, generateFaq);
router.get("/analytics", protect, requireAdmin, knowledgeBaseAnalytics);
router.get("/documents", protect, requireAdmin, listKnowledgeDocuments);
router.post("/documents", protect, requireAdmin, createKnowledgeDocument);
router.delete("/documents/:id", protect, requireAdmin, archiveKnowledgeDocument);
router.post("/", protect, requireAdmin, createArticle);
router.patch("/:id", protect, requireAdmin, updateArticle);
router.delete("/:id", protect, requireAdmin, deleteArticle);

export default router;
