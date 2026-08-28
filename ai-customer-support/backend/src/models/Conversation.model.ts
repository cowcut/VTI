import { Document, model, Schema, Types } from "mongoose";
import { calculateSlaDeadline, routingKeyForCategory } from "../services/ticket-management.service";

export type ConversationStatus = "open" | "pending" | "resolved" | "closed";
export type ConversationMode = "ai" | "human";
export type ConversationPriority = "low" | "normal" | "high" | "urgent";
export type ConversationCategory = "general" | "account" | "billing" | "technical" | "other";

export interface IConversation extends Document {
  customer: Types.ObjectId;
  assignedAgent?: Types.ObjectId;
  subject?: string;
  status: ConversationStatus;
  mode: ConversationMode;
  priority: ConversationPriority;
  category: ConversationCategory;
  routingKey: ConversationCategory;
  slaDeadline: Date;
  firstResponseAt?: Date;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedAgent: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: ["open", "pending", "resolved", "closed"],
      default: "open",
      index: true,
    },
    mode: {
      type: String,
      enum: ["ai", "human"],
      default: "ai",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    category: {
      type: String,
      enum: ["general", "account", "billing", "technical", "other"],
      default: "general",
      index: true,
    },
    routingKey: {
      type: String,
      enum: ["general", "account", "billing", "technical", "other"],
      default: "general",
      index: true,
    },
    slaDeadline: {
      type: Date,
      index: true,
    },
    firstResponseAt: {
      type: Date,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

conversationSchema.pre("validate", function setTicketOperationalMetadata() {
  if (this.isModified("category")) this.routingKey = routingKeyForCategory(this.category);
  if (this.isModified("priority") || !this.slaDeadline) this.slaDeadline = calculateSlaDeadline(this.priority, this.createdAt || new Date());
});

conversationSchema.index({ customer: 1, lastMessageAt: -1 });
conversationSchema.index({ priority: 1, category: 1, lastMessageAt: -1 });

export const Conversation = model<IConversation>("Conversation", conversationSchema);
