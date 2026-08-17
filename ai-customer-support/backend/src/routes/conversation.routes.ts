import { Router } from "express";
import {
  createConversation,
  createMessage,
  getConversations,
  getMessages,
  handoffConversation,
  updateConversationStatus,
} from "../controllers/conversation.controller";
import { protect } from "../middleware/auth.middleware";
import { messageRateLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

router.use(protect);
router.post("/", createConversation);
router.get("/", getConversations);
router.patch("/:id/status", updateConversationStatus);
router.post("/:id/handoff", handoffConversation);
router.get("/:id/messages", getMessages);
router.post("/:id/messages", messageRateLimiter, createMessage);

export default router;
