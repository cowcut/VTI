import type { ConversationCategory, ConversationPriority } from "../models/Conversation.model";

const priorities: ConversationPriority[] = ["low", "normal", "high", "urgent"];
const categories: ConversationCategory[] = ["general", "account", "billing", "technical", "other"];

const SLA_DURATION_MS: Record<ConversationPriority, number> = {
  urgent: 60 * 60 * 1000,
  high: 4 * 60 * 60 * 1000,
  normal: 24 * 60 * 60 * 1000,
  low: 72 * 60 * 60 * 1000,
};

export const calculateSlaDeadline = (priority: ConversationPriority, from: Date = new Date()) =>
  new Date(from.getTime() + SLA_DURATION_MS[priority]);

export const routingKeyForCategory = (category: ConversationCategory): ConversationCategory => category;

export const normalizeTicketMetadata = (input: Record<string, unknown>) => {
  const changes: Partial<{ priority: ConversationPriority; category: ConversationCategory; routingKey: ConversationCategory }> = {};
  if (input.priority !== undefined) {
    if (!priorities.includes(input.priority as ConversationPriority)) throw new Error("Invalid ticket priority");
    changes.priority = input.priority as ConversationPriority;
  }
  if (input.category !== undefined) {
    if (!categories.includes(input.category as ConversationCategory)) throw new Error("Invalid ticket category");
    changes.category = input.category as ConversationCategory;
    changes.routingKey = routingKeyForCategory(changes.category);
  }
  if (!Object.keys(changes).length) throw new Error("Ticket metadata is required");
  return changes;
};
