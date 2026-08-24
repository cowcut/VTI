import { NextFunction, Request, Response } from "express";
import { User } from "../models/User.model";
import { AuthenticatedRequest } from "../types/auth";
import { signAuthToken } from "../utils/jwt";
import { normalizeLoginInput, normalizeRegistrationInput } from "../services/auth-input.service";

const sanitizeUser = (user: any) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let input;
    try { input = normalizeRegistrationInput(req.body ?? {}); } catch (error) {
      return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid registration input" });
    }

    const existingUser = await User.findOne({ email: input.email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const user = await User.create({ ...input, role: "customer" });
    const token = signAuthToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: "Register successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let input;
    try { input = normalizeLoginInput(req.body ?? {}); } catch (error) {
      return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid login input" });
    }

    const user = await User.findOne({ email: input.email }).select("+password");
    if (!user || !(await user.comparePassword(input.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account has been disabled. Contact an administrator.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();
    const token = signAuthToken(user._id.toString());

    return res.status(200).json({
      success: true,
      message: "Login successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const me = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  return res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
};
