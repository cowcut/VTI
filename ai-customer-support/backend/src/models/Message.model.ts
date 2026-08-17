import { Document, model, Schema, Types } from "mongoose";

export type MessageSenderType = "customer" | "agent" | "ai" | "system";
export type MessageType = "text" | "image" | "file" | "system";

export interface IMessage extends Document {
  conversation: Types.ObjectId;
  sender?: Types.ObjectId;
  senderType: MessageSenderType;
  messageType: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    senderType: {
      type: String,
      enum: ["customer", "agent", "ai", "system"],
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "file", "system"],
      default: "text",
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export const Message = model<IMessage>("Message", messageSchema);
