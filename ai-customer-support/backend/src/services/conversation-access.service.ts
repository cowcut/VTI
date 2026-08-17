import { Types } from "mongoose";
import { IUser } from "../models/User.model";

type ConversationAccessRecord = {
  customer: Types.ObjectId;
  assignedAgent?: Types.ObjectId | null;
};

const sameId = (left: { toString(): string } | null | undefined, right: { toString(): string } | null | undefined) =>
  Boolean(left && right && left.toString() === right.toString());

export const isAdmin = (user?: IUser) => user?.role === "admin";
export const isAgent = (user?: IUser) => user?.role === "agent";
export const isStaff = (user?: IUser) => isAdmin(user) || isAgent(user);

export const conversationQuery = (user: IUser) => {
  if (isAdmin(user)) return {};
  if (isAgent(user)) return { $or: [{ assignedAgent: user._id }, { assignedAgent: null }] };
  return { customer: user._id };
};

export const canAccessConversation = (conversation: ConversationAccessRecord, user?: IUser): boolean => {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isAgent(user)) return !conversation.assignedAgent || sameId(conversation.assignedAgent, user._id);
  return sameId(conversation.customer, user._id);
};

export const canManageConversation = (conversation: ConversationAccessRecord, user?: IUser): boolean =>
  Boolean(user && (isAdmin(user) || (isAgent(user) && sameId(conversation.assignedAgent, user._id))));
