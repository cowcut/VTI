import { NextFunction, Response } from "express";
import { Conversation } from "../models/Conversation.model";
import { isAdmin } from "../services/conversation-access.service";
import {
  buildOperationalTicketAnalyticsPipeline,
  formatOperationalTicketAnalytics,
} from "../services/operations-analytics.service";
import { AuthenticatedRequest } from "../types/auth";

export const getOperationalTicketAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: "Admin access is required" });
    const results = await Conversation.aggregate(buildOperationalTicketAnalyticsPipeline(new Date()) as never);
    return res.json({ success: true, analytics: formatOperationalTicketAnalytics(results) });
  } catch (error) {
    return next(error);
  }
};
