import { NextFunction, Response } from "express";
import { Notification } from "../models/Notification.model";
import { AuthenticatedRequest } from "../types/auth";

const validObjectId = (id?: string) => Boolean(id && /^[a-f\d]{24}$/i.test(id));

export const listNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || "20"), 10) || 20));
    const notifications = await Notification.find({ recipient: req.user!._id }).sort({ createdAt: -1 }).limit(limit);
    const unreadCount = await Notification.countDocuments({ recipient: req.user!._id, readAt: null });
    return res.json({ success: true, notifications, unreadCount });
  } catch (error) { return next(error); }
};

export const markNotificationRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!validObjectId(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid notification id" });
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user!._id }, { $set: { readAt: new Date() } }, { new: true });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.json({ success: true, notification });
  } catch (error) { return next(error); }
};

export const markAllNotificationsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await Notification.updateMany({ recipient: req.user!._id, readAt: null }, { $set: { readAt: new Date() } });
    return res.json({ success: true });
  } catch (error) { return next(error); }
};
