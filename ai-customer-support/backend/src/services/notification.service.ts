import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/Notification.model";

export const createNotification = async (input: { recipient: Types.ObjectId; conversation: Types.ObjectId; type: NotificationType; title: string; body: string }) => Notification.create(input);
