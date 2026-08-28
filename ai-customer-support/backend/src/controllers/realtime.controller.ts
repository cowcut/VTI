import { NextFunction, Response } from "express";
import { subscribeRealtimeEvents } from "../services/realtime.service";
import { AuthenticatedRequest } from "../types/auth";

export const streamRealtimeEvents = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    subscribeRealtimeEvents(req.user!._id.toString(), res);
  } catch (error) {
    next(error);
  }
};
