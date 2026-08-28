import { buildSupportPrompt, GeminiSupportReply, parseGeminiSupportReply } from "./gemini.service";
import { KnowledgeCitation } from "./knowledge-base-enhancements.service";
import { VerifiedSupportTools } from "./support-tools.service";

type PromptMessage = { senderType: string; content: string };
type StreamKnowledge = { title: string; content: string; tags?: string[]; citation?: KnowledgeCitation };
type StreamInput = { subject?: string; messages: PromptMessage[]; knowledge?: StreamKnowledge[]; toolContext?: VerifiedSupportTools | null };
type GeminiStreamingConfig = { fetchImpl?: typeof fetch; model?: string };

type GeminiStreamEvent =
  | { type: "progress"; message: "Generating support reply…" }
  | { type: "final"; reply: GeminiSupportReply };

type GeminiStreamPayload = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

export const GEMINI_STREAM_TIMEOUT_MS = 25_000;
const SAFE_PROGRESS_MESSAGE = "Generating support reply…" as const;

const readSseData = (frame: string): string | null => {
  const dataLines = frame.split("\n").filter((line) => line.startsWith("data:"));
  if (!dataLines.length) return null;
  return dataLines.map((line) => line.slice(5).trimStart()).join("\n");
};

const extractText = (data: string): string => {
  if (data === "[DONE]") return "";
  let payload: GeminiStreamPayload;
  try {
    payload = JSON.parse(data) as GeminiStreamPayload;
  } catch {
    throw new Error("Gemini stream returned invalid JSON");
  }
  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
};

export async function* streamGeminiSupportReply(input: StreamInput, config: GeminiStreamingConfig = {}): AsyncGenerator<GeminiStreamEvent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const model = config.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const fetchImpl = config.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_STREAM_TIMEOUT_MS);

  try {
    yield { type: "progress", message: SAFE_PROGRESS_MESSAGE };
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildSupportPrompt(input) }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`Gemini stream request failed with status ${response.status}`);
    if (!response.body) throw new Error("Gemini stream returned no response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let rawReply = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || "";
      for (const frame of frames) {
        const data = readSseData(frame);
        if (data !== null) rawReply += extractText(data);
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const data = readSseData(buffer);
      if (data !== null) rawReply += extractText(data);
    }
    if (!rawReply.trim()) throw new Error("Gemini stream returned no text response");
    const reply = parseGeminiSupportReply(rawReply);
    const citations = input.knowledge?.flatMap((item) => item.citation ? [item.citation] : []) ?? [];
    yield { type: "final", reply: citations.length ? { ...reply, citations } : reply };
  } finally {
    clearTimeout(timeout);
  }
}
