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
import { streamGeminiSupportReply } from "../services/gemini-streaming.service";
import { publishRealtimeEvent } from "../services/realtime.service";
import { shouldEscalateAiReply } from "../services/ai-escalation.service";
import { findRelevantKnowledge, recordKnowledgeGap } from "../services/knowledge-base.service";
import { sanitizeCitations } from "../services/knowledge-base-enhancements.service";
import { dispatchSupportTools } from "../services/support-tools.service";
import { normalizeTicketMetadata } from "../services/ticket-management.service";
import { createNotification } from "../services/notification.service";
import { AuthenticatedRequest } from "../types/auth";

const allowedStatuses = ["open", "pending", "resolved", "closed"] as const;
const statusTransitions: Record<(typeof allowedStatuses)[number], string[]> = {
  open: ["pending", "resolved", "closed"],
  pending: ["open", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

const validObjectId = (id?: string) => Boolean(id && /^[a-f\d]{24}$/i.test(id));
const publicMessage = (message: { toObject(): Record<string, unknown> }) => {
  const result = message.toObject();
  const metadata = result.metadata as Record<string, unknown> | undefined;
  if (metadata?.citations) result.metadata = { ...metadata, citations: sanitizeCitations(metadata.citations) };
  return result;
};

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
    return res.status(200).json({ success: true, conversation, messages: messages.map(publicMessage) });
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
    if (senderType === "agent") { conversation.mode = "human"; conversation.status = "pending"; if (!conversation.firstResponseAt) conversation.firstResponseAt = message.createdAt; }
    if (senderType === "customer" && conversation.status === "resolved") conversation.status = "open";
    await conversation.save();
    if (senderType === "agent") void createNotification({ recipient: conversation.customer, conversation: conversation._id, type: "agent_reply", title: "Bạn có phản hồi mới", body: conversation.subject || "Nhân viên hỗ trợ đã trả lời ticket của bạn." }).catch(console.error);
    if (senderType === "customer" && conversation.mode === "human" && conversation.assignedAgent) void createNotification({ recipient: conversation.assignedAgent, conversation: conversation._id, type: "customer_reply", title: "Khách hàng đã phản hồi", body: conversation.subject || "Một ticket bạn phụ trách có tin nhắn mới." }).catch(console.error);

    let aiMessage = null;
    let handoffMessage = null;
    if (shouldGenerateAiReply({ senderType, mode: conversation.mode })) {
      try {
        const history = await Message.find({ conversation: conversation._id, messageType: { $ne: "internal_note" } }).sort({ createdAt: 1 }).select("senderType content");
        const knowledge = await findRelevantKnowledge(content);
        if (!knowledge.length) void recordKnowledgeGap(content).catch(console.error);
        const toolContext = dispatchSupportTools(content);
        let reply = null;
        try {
          for await (const event of streamGeminiSupportReply({ subject: conversation.subject, messages: history, knowledge, toolContext })) {
            if (event.type === "progress") publishRealtimeEvent(conversation.customer.toString(), "ai_status");
            else reply = event.reply;
          }
        } catch (streamError) {
          console.error("Gemini stream failed; retrying without stream", streamError instanceof Error ? streamError.message : streamError);
          reply = await generateGeminiReply({ subject: conversation.subject, messages: history, knowledge, toolContext });
        }
        if (reply) {
          const requiresHuman = shouldEscalateAiReply({ customerMessage: content, reply });
          const metadata = {
            requiresHuman,
            ...(reply.confidence !== undefined ? { confidence: reply.confidence } : {}),
            ...(reply.sentiment !== undefined ? { sentiment: reply.sentiment } : {}),
            ...(reply.citations?.length ? { citations: reply.citations } : {}),
            ...(toolContext ? { toolContext } : {}),
          };
          aiMessage = await Message.create({ conversation: conversation._id, senderType: "ai", content: reply.content, metadata });
          conversation.lastMessageAt = aiMessage.createdAt;
          if (!conversation.firstResponseAt) conversation.firstResponseAt = aiMessage.createdAt;
          if (requiresHuman) {
            conversation.mode = "human";
            conversation.status = "pending";
            handoffMessage = await Message.create({ conversation: conversation._id, senderType: "system", messageType: "system", content: "AI đã chuyển yêu cầu này cho nhân viên hỗ trợ." });
            conversation.lastMessageAt = handoffMessage.createdAt;
          }
          await conversation.save();
          publishRealtimeEvent(conversation.customer.toString(), "conversation");
        }
      } catch (aiError) {
        console.error("Gemini reply generation failed", aiError instanceof Error ? aiError.message : aiError);
      }
    }

    return res.status(201).json({ success: true, message, aiMessage: aiMessage ? publicMessage(aiMessage) : null, handoffMessage });
  } catch (error) { return next(error); }
};

export const generateAgentReplyDraft = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid conversation id" });
    if (!isAgent(req.user) && !isAdmin(req.user)) return res.status(403).json({ success: false, message: "Only support staff can generate a reply draft" });
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!canManageConversation(conversation, req.user)) return res.status(403).json({ success: false, message: "Claim this conversation before generating a reply draft" });
    const history = await Message.find({ conversation: conversation._id, messageType: { $ne: "internal_note" } }).sort({ createdAt: 1 }).select("senderType content");
    const latestCustomerMessage = [...history].reverse().find((message) => message.senderType === "customer")?.content || "";
    const knowledge = await findRelevantKnowledge(latestCustomerMessage);
    const toolContext = dispatchSupportTools(latestCustomerMessage);
    const reply = await generateGeminiReply({ subject: conversation.subject, messages: history, knowledge, toolContext });
    if (!reply) return res.status(503).json({ success: false, message: "AI reply draft is unavailable" });
    return res.json({ success: true, draft: reply.content, citations: sanitizeCitations(reply.citations) });
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
    void createNotification({ recipient: conversation.customer, conversation: conversation._id, type: "ticket_status", title: "Ticket đã đổi trạng thái", body: `${conversation.subject || "Yêu cầu hỗ trợ"}: ${status}` }).catch(console.error);
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

    const requestedAgentId = (req.body ?? {}).assignedAgentId as string | undefined;
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
    void createNotification({ recipient: conversation.customer, conversation: conversation._id, type: "ticket_handoff", title: "Ticket đã được chuyển nhân viên", body: conversation.subject || "Đội hỗ trợ sẽ phản hồi bạn sớm." }).catch(console.error);
    void createNotification({ recipient: agentId, conversation: conversation._id, type: "ticket_handoff", title: "Bạn được giao một ticket", body: conversation.subject || "Một ticket mới cần bạn xử lý." }).catch(console.error);
    return res.status(200).json({ success: true, conversation, message: systemMessage });
  } catch (error) { return next(error); }
};
