import { NextFunction, Response } from "express";
import { User, UserRole } from "../models/User.model";
import { canManageAccount, normalizeAccountInput } from "../services/account-management.service";
import { AuthenticatedRequest } from "../types/auth";

const accountView = (user: any) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const validObjectId = (id: string) => /^[a-f\d]{24}$/i.test(id);
const roleOptions: UserRole[] = ["admin", "agent", "customer"];

export const listAccounts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || "50"), 10) || 50));
    const role = String(req.query.role || "");
    const status = String(req.query.status || "");
    const search = String(req.query.q || "").trim();
    const query: Record<string, unknown> = {};
    if (roleOptions.includes(role as UserRole)) query.role = role;
    if (status === "active") query.isActive = true;
    if (status === "disabled") query.isActive = false;
    if (search) query.$or = [{ name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { email: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }];

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(query),
    ]);
    return res.json({ success: true, accounts: users.map(accountView), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
};

export const updateAccount = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!validObjectId(id)) return res.status(400).json({ success: false, message: "Invalid account id" });
    const account = await User.findById(id);
    if (!account) return res.status(404).json({ success: false, message: "Account not found" });
    let changes: ReturnType<typeof normalizeAccountInput>;
    try { changes = normalizeAccountInput(req.body); } catch (error) { return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid account changes" }); }
    if (!canManageAccount({ role: req.user!.role, id: req.user!._id.toString() }, { role: account.role, id: account._id.toString(), isActive: changes.isActive ?? account.isActive })) {
      return res.status(403).json({ success: false, message: "Administrators cannot disable their own account" });
    }
    if (changes.role === "customer" && account.role !== "customer") {
      const remainingAdmins = account.role === "admin" ? await User.countDocuments({ role: "admin", isActive: true }) : 2;
      if (remainingAdmins < 2) return res.status(409).json({ success: false, message: "At least one active admin account is required" });
    }
    Object.assign(account, changes);
    await account.save();
    return res.json({ success: true, account: accountView(account) });
  } catch (error) { return next(error); }
};
