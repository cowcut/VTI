import { NextFunction, Response } from "express";
import { Conversation } from "../models/Conversation.model";
import { Message } from "../models/Message.model";
import { User } from "../models/User.model";
import {
  canAccessConversation,
  canManageConversation,
  conversationQuery,
  isAdmin,
  isAgent,
} from "../services/conversation-access.service";
import { generateGeminiReply, shouldGenerateAiReply } from "../services/gemini.service";
import { findRelevantKnowledge } from "../services/knowledge-base.service";
import { normalizeTicketMetadata } from "../services/ticket-management.service";
import { AuthenticatedRequest } from "../types/auth";

const allowedStatuses = ["open", "pending", "resolved", "closed"] as const;
const statusTransitions: Record<(typeof allowedStatuses)[number], string[]> = {
  open: ["pending", "resolved", "closed"],
  pending: ["open", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

const validObjectId = (id?: string) => Boolean(id && /^[a-f\d]{24}$/i.test(id));

export const createConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subject = typeof req.body.subject === "string" ? req.body.subject.trim() : "";
    if (subject.length > 200) return res.status(400).json({ success: false, message: "Subject must be at most 200 characters" });
    const conversation = await Conversation.create({ customer: req.user?._id, subject: subject || "Yêu cầu hỗ trợ mới" });
    return res.status(201).json({ success: true, conversation });
  } catch (error) { return next(error); }
};

export const getConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || "25"), 10) || 25));
    const status = String(req.query.status || "");
    const query = { ...conversationQuery(user) } as Record<string, unknown>;
    if (allowedStatuses.includes(status as (typeof allowedStatuses)[number])) query.status = status;

    const [conversations, total] = await Promise.all([
      Conversation.find(query).populate("customer", "name email role avatar").populate("assignedAgent", "name email role avatar").sort({ lastMessageAt: -1 }).skip((page - 1) * limit).limit(limit),
      Conversation.countDocuments(query),
    ]);
    return res.status(200).json({ success: true, conversations, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
};

export const getMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid conversation id" });
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!canAccessConversation(conversation, req.user)) return res.status(403).json({ success: false, message: "Access denied" });
    const messageQuery: Record<string, unknown> = { conversation: conversation._id };
    if (!isAgent(req.user) && !isAdmin(req.user)) messageQuery.messageType = { $ne: "internal_note" };
    const messages = await Message.find(messageQuery).populate("sender", "name email role avatar").sort({ createdAt: 1 });
    return res.status(200).json({ success: true, conversation, messages });
  } catch (error) { return next(error); }
};

export const createMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid conversation id" });
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!content) return res.status(400).json({ success: false, message: "Message content is required" });
    if (content.length > 5000) return res.status(400).json({ success: false, message: "Message content must be at most 5000 characters" });

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!canAccessConversation(conversation, req.user)) return res.status(403).json({ success: false, message: "Access denied" });
    const senderType = isAgent(req.user) || isAdmin(req.user) ? "agent" : "customer";
    if (senderType === "agent" && !canManageConversation(conversation, req.user)) return res.status(403).json({ success: false, message: "Claim this conversation before replying" });

    const message = await Message.create({ conversation: conversation._id, sender: req.user?._id, senderType, content });
    conversation.lastMessageAt = message.createdAt;
    if (senderType === "agent") { conversation.mode = "human"; conversation.status = "pending"; }
    if (senderType === "customer" && conversation.status === "resolved") conversation.status = "open";
    await conversation.save();

    let aiMessage = null;
    let handoffMessage = null;
    if (shouldGenerateAiReply({ senderType, mode: conversation.mode })) {
      try {
        const history = await Message.find({ conversation: conversation._id, messageType: { $ne: "internal_note" } }).sort({ createdAt: 1 }).select("senderType content");
        const knowledge = await findRelevantKnowledge(content);
        const reply = await generateGeminiReply({ subject: conversation.subject, messages: history, knowledge });
        if (reply) {
          aiMessage = await Message.create({ conversation: conversation._id, senderType: "ai", content: reply.content, metadata: { requiresHuman: reply.requiresHuman } });
          conversation.lastMessageAt = aiMessage.createdAt;
          if (reply.requiresHuman) {
            conversation.mode = "human";
            conversation.status = "pending";
            handoffMessage = await Message.create({ conversation: conversation._id, senderType: "system", messageType: "system", content: "AI đã chuyển yêu cầu này cho nhân viên hỗ trợ." });
            conversation.lastMessageAt = handoffMessage.createdAt;
          }
          await conversation.save();
        }
      } catch (aiError) {
        console.error("Gemini reply generation failed", aiError instanceof Error ? aiError.message : aiError);
      }
    }

    return res.status(201).json({ success: true, message, aiMessage, handoffMessage });
  } catch (error) { return next(error); }
};

export const updateConversationStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid conversation id" });
    const status = req.body.status as string;
    if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) return res.status(400).json({ success: false, message: "Invalid conversation status" });
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!canManageConversation(conversation, req.user)) return res.status(403).json({ success: false, message: "Only the assigned agent or admin can update status" });
    if (conversation.status !== status && !statusTransitions[conversation.status].includes(status)) return res.status(400).json({ success: false, message: `Cannot change ${conversation.status} directly to ${status}` });
    conversation.status = status as typeof conversation.status;
    await conversation.save();
    return res.status(200).json({ success: true, conversation });
  } catch (error) { return next(error); }
};

export const updateConversationMetadata = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid conversation id" });
    let changes;
    try { changes = normalizeTicketMetadata(req.body ?? {}); } catch (error) { return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid ticket metadata" }); }
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!canManageConversation(conversation, req.user)) return res.status(403).json({ success: false, message: "Only the assigned agent or admin can update ticket metadata" });
    Object.assign(conversation, changes);
    await conversation.save();
    return res.json({ success: true, conversation });
  } catch (error) { return next(error); }
};

export const createInternalNote = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid conversation id" });
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > 5000) return res.status(400).json({ success: false, message: "Internal note must be 1 to 5000 characters" });
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!canManageConversation(conversation, req.user)) return res.status(403).json({ success: false, message: "Only the assigned agent or admin can add internal notes" });
    const note = await Message.create({ conversation: conversation._id, sender: req.user!._id, senderType: "agent", messageType: "internal_note", content });
    return res.status(201).json({ success: true, note });
  } catch (error) { return next(error); }
};

export const handoffConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid conversation id" });
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    const requestedAgentId = req.body.assignedAgentId as string | undefined;
    let agentId = req.user!._id;
    if (isAdmin(req.user) && requestedAgentId) {
      if (!validObjectId(requestedAgentId)) return res.status(400).json({ success: false, message: "Invalid assigned agent id" });
      const target = await User.findOne({ _id: requestedAgentId, role: { $in: ["agent", "admin"] } });
      if (!target) return res.status(404).json({ success: false, message: "Target agent not found" });
      agentId = target._id;
    } else if (!isAdmin(req.user) && (!isAgent(req.user) || conversation.assignedAgent)) {
      return res.status(403).json({ success: false, message: "Only admins can reassign tickets; agents can claim unassigned tickets" });
    }

    conversation.assignedAgent = agentId;
    conversation.mode = "human";
    conversation.status = "pending";
    const systemMessage = await Message.create({ conversation: conversation._id, sender: req.user?._id, senderType: "system", messageType: "system", content: "Cuộc hội thoại đã được chuyển cho nhân viên hỗ trợ." });
    conversation.lastMessageAt = systemMessage.createdAt;
    await conversation.save();
    return res.status(200).json({ success: true, conversation, message: systemMessage });
  } catch (error) { return next(error); }
};
