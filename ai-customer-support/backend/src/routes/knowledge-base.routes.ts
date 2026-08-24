import { Router } from "express";
import { createArticle, deleteArticle, listPublishedArticles, searchPublishedArticles, updateArticle } from "../controllers/knowledge-base.controller";
import { protect } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";

const router = Router();

router.get("/", listPublishedArticles);
router.get("/search", searchPublishedArticles);
router.post("/", protect, requireAdmin, createArticle);
router.patch("/:id", protect, requireAdmin, updateArticle);
router.delete("/:id", protect, requireAdmin, deleteArticle);

export default router;
