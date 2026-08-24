import { ConversationCategory, ConversationPriority } from "../models/Conversation.model";

const priorities: ConversationPriority[] = ["low", "normal", "high", "urgent"];
const categories: ConversationCategory[] = ["general", "account", "billing", "technical", "other"];

export const normalizeTicketMetadata = (input: Record<string, unknown>) => {
  const changes: Partial<{ priority: ConversationPriority; category: ConversationCategory }> = {};
  if (input.priority !== undefined) {
    if (!priorities.includes(input.priority as ConversationPriority)) throw new Error("Invalid ticket priority");
    changes.priority = input.priority as ConversationPriority;
  }
  if (input.category !== undefined) {
    if (!categories.includes(input.category as ConversationCategory)) throw new Error("Invalid ticket category");
    changes.category = input.category as ConversationCategory;
  }
  if (!Object.keys(changes).length) throw new Error("Ticket metadata is required");
  return changes;
};
