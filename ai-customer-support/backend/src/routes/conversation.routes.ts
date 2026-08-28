import { Router } from "express";
import {
  createConversation,
  generateAgentReplyDraft,
  createMessage,
  getConversations,
  getMessages,
  handoffConversation,
  createInternalNote,
  updateConversationMetadata,
  updateConversationStatus,
} from "../controllers/conversation.controller";
import { protect } from "../middleware/auth.middleware";
import { messageRateLimiter } from "../middleware/rate-limit.middleware";
import { attachmentUpload, downloadAttachment, uploadAttachment } from "../controllers/attachment.controller";

const router = Router();

router.use(protect);
router.post("/", createConversation);
router.get("/", getConversations);
router.patch("/:id/status", updateConversationStatus);
router.patch("/:id/metadata", updateConversationMetadata);
router.post("/:id/handoff", handoffConversation);
router.post("/:id/internal-notes", createInternalNote);
router.post("/:id/ai-draft", messageRateLimiter, generateAgentReplyDraft);
router.post("/:id/attachments", messageRateLimiter, attachmentUpload.single("attachment"), uploadAttachment);
router.get("/attachments/:messageId", downloadAttachment);
router.get("/:id/messages", getMessages);
router.post("/:id/messages", messageRateLimiter, createMessage);

export default router;
