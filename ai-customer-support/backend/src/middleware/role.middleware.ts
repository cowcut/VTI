import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/auth";

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") return res.status(403).json({ success: false, message: "Administrator access required" });
  return next();
};
