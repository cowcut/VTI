import { UserRole } from "../models/User.model";

const roles: UserRole[] = ["admin", "agent", "customer"];

type Actor = { role: UserRole; id: string };
type Target = { role: UserRole; id: string; isActive: boolean };

export const canManageAccount = (actor: Actor, target: Target) =>
  actor.role === "admin" && !(actor.id === target.id && target.isActive === false);

export const normalizeAccountInput = (input: Record<string, unknown>) => {
  const result: { name?: string; role?: UserRole; isActive?: boolean } = {};
  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100) throw new Error("Invalid name");
    result.name = input.name.trim();
  }
  if (input.role !== undefined) {
    if (typeof input.role !== "string" || !roles.includes(input.role as UserRole)) throw new Error("Invalid role");
    result.role = input.role as UserRole;
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== "boolean") throw new Error("Invalid active state");
    result.isActive = input.isActive;
  }
  if (!Object.keys(result).length) throw new Error("No account changes provided");
  return result;
};
