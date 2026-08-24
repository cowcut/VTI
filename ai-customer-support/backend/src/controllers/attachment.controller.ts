import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { NextFunction, Response } from "express";
import { Conversation } from "../models/Conversation.model";
import { Message } from "../models/Message.model";
import { canAccessConversation, canManageConversation, isAdmin, isAgent } from "../services/conversation-access.service";
import { allowedAttachmentMimeTypes, maxAttachmentBytes, validateAttachment } from "../services/attachment.service";
import { AuthenticatedRequest } from "../types/auth";

const uploadDirectory = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
const validObjectId = (id?: string) => Boolean(id && /^[a-f\d]{24}$/i.test(id));

fs.mkdirSync(uploadDirectory, { recursive: true, mode: 0o750 });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 12)}`),
});

export const attachmentUpload = multer({
  storage,
  limits: { fileSize: maxAttachmentBytes, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, allowedAttachmentMimeTypes.includes(file.mimetype as (typeof allowedAttachmentMimeTypes)[number])),
});

const removeUploadedFile = (file?: Express.Multer.File) => {
  if (file?.path) fs.unlink(file.path, () => undefined);
};

export const uploadAttachment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) { removeUploadedFile(req.file); return res.status(400).json({ success: false, message: "Invalid conversation id" }); }
    if (!req.file) return res.status(400).json({ success: false, message: "Choose a supported file up to 5 MB" });
    try { validateAttachment(req.file); } catch (error) { removeUploadedFile(req.file); return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid attachment" }); }
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) { removeUploadedFile(req.file); return res.status(404).json({ success: false, message: "Conversation not found" }); }
    if (!canAccessConversation(conversation, req.user)) { removeUploadedFile(req.file); return res.status(403).json({ success: false, message: "Access denied" }); }
    const senderType = isAgent(req.user) || isAdmin(req.user) ? "agent" : "customer";
    if (senderType === "agent" && !canManageConversation(conversation, req.user)) { removeUploadedFile(req.file); return res.status(403).json({ success: false, message: "Claim this conversation before uploading" }); }
    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user!._id,
      senderType,
      messageType: "file",
      content: `Đã đính kèm tệp: ${req.file.originalname}`,
      metadata: { fileName: req.file.originalname, storedName: req.file.filename, mimeType: req.file.mimetype, size: req.file.size },
    });
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();
    return res.status(201).json({ success: true, message });
  } catch (error) { removeUploadedFile(req.file); return next(error); }
};

export const downloadAttachment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.messageId))) return res.status(400).json({ success: false, message: "Invalid attachment id" });
    const message = await Message.findOne({ _id: req.params.messageId, messageType: "file" });
    if (!message) return res.status(404).json({ success: false, message: "Attachment not found" });
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !canAccessConversation(conversation, req.user)) return res.status(403).json({ success: false, message: "Access denied" });
    const metadata = message.metadata as { storedName?: string; fileName?: string } | undefined;
    if (!metadata?.storedName || path.basename(metadata.storedName) !== metadata.storedName) return res.status(404).json({ success: false, message: "Attachment unavailable" });
    const filePath = path.join(uploadDirectory, metadata.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: "Attachment unavailable" });
    return res.download(filePath, metadata.fileName || "attachment");
  } catch (error) { return next(error); }
};
