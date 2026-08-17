import { Document, model, Schema, Types } from "mongoose";

export type ConversationStatus = "open" | "pending" | "resolved" | "closed";
export type ConversationMode = "ai" | "human";

export interface IConversation extends Document {
  customer: Types.ObjectId;
  assignedAgent?: Types.ObjectId;
  subject?: string;
  status: ConversationStatus;
  mode: ConversationMode;
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
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ customer: 1, lastMessageAt: -1 });

export const Conversation = model<IConversation>("Conversation", conversationSchema);
