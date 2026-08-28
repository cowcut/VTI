import { Response } from "express";

const subscribers = new Map<string, Set<Response>>();

const writeEvent = (response: Response, event: string, payload: Record<string, unknown>) => {
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
};

export const subscribeRealtimeEvents = (userId: string, response: Response) => {
  response.status(200).set({
    "Cache-Control": "no-cache, no-transform",
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();
  const userSubscribers = subscribers.get(userId) ?? new Set<Response>();
  userSubscribers.add(response);
  subscribers.set(userId, userSubscribers);
  writeEvent(response, "ready", { type: "ready" });
  const heartbeat = setInterval(() => writeEvent(response, "ping", { type: "ping" }), 25_000);
  response.on("close", () => {
    clearInterval(heartbeat);
    userSubscribers.delete(response);
    if (!userSubscribers.size) subscribers.delete(userId);
  });
};

export const publishRealtimeEvent = (userId: string, type: "notification" | "conversation" | "ai_status") => {
  const userSubscribers = subscribers.get(userId);
  if (!userSubscribers) return;
  for (const response of userSubscribers) writeEvent(response, type, { type });
};
