import { Document, model, Schema, Types } from "mongoose";

export type NotificationType = "agent_reply" | "ticket_status" | "ticket_handoff" | "customer_reply";

export interface INotification extends Document {
  recipient: Types.ObjectId;
  conversation: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>({
  recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  type: { type: String, enum: ["agent_reply", "ticket_status", "ticket_handoff", "customer_reply"], required: true },
  title: { type: String, required: true, maxlength: 160 },
  body: { type: String, required: true, maxlength: 500 },
  readAt: { type: Date, default: null, index: true },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
export const Notification = model<INotification>("Notification", notificationSchema);
