import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/Notification.model";
import { publishRealtimeEvent } from "./realtime.service";

export const createNotification = async (input: { recipient: Types.ObjectId; conversation: Types.ObjectId; type: NotificationType; title: string; body: string }) => {
  const notification = await Notification.create(input);
  publishRealtimeEvent(input.recipient.toString(), "notification");
  return notification;
};
