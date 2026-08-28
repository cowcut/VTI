import { GeminiSupportReply } from "./gemini.service";

const HUMAN_REQUEST = /\b(nhân viên|người thật|con người|gặp người)\b/i;
const SAFE_CONFIDENCE_THRESHOLD = 0.4;
const NEGATIVE_CONFIDENCE_THRESHOLD = 0.6;

export const shouldEscalateAiReply = ({ customerMessage, reply }: { customerMessage: string; reply: GeminiSupportReply }) =>
  reply.requiresHuman
  || HUMAN_REQUEST.test(customerMessage)
  || (typeof reply.confidence === "number" && reply.confidence < SAFE_CONFIDENCE_THRESHOLD)
  || (reply.sentiment === "negative" && typeof reply.confidence === "number" && reply.confidence < NEGATIVE_CONFIDENCE_THRESHOLD);
