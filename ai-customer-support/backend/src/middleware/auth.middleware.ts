import { NextFunction, Response } from "express";
import { User } from "../models/User.model";
import { AuthenticatedRequest } from "../types/auth";
import { verifyAuthToken } from "../utils/jwt";

export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, user not found or disabled",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, invalid token",
    });
  }
};
