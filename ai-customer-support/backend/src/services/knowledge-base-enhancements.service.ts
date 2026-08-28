export type KnowledgeCitation = { sourceId: string; sourceType: "article" | "document"; title: string };
export type PublicCitation = Pick<KnowledgeCitation, "sourceType" | "title">;
export type FaqDraft = { title: string; content: string; tags: string[]; isPublished: false };

type GeminiConfig = { apiKey?: string; model?: string; fetchImpl?: typeof fetch };

const cleanTopic = (value: unknown) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 160) throw new Error("topic must be 1 to 160 characters");
  return value.trim().replace(/\s+/g, " ");
};

export const buildFaqFallback = (topic: string): FaqDraft => ({
  title: `Câu hỏi thường gặp: ${topic}`,
  content: `## Câu hỏi\nLàm thế nào để ${topic}?\n\n## Trả lời\nHãy kiểm tra hướng dẫn đã được xuất bản hoặc liên hệ đội hỗ trợ để được xác minh.\n\n## Khi nào cần hỗ trợ thêm\nNếu hướng dẫn không giải quyết được vấn đề, hãy tạo một yêu cầu hỗ trợ.`,
  tags: [topic.toLowerCase()],
  isPublished: false,
});

export const parseFaqDraft = (text: string): FaqDraft => {
  let parsed: { title?: unknown; content?: unknown; tags?: unknown };
  try { parsed = JSON.parse(text); } catch { throw new Error("Gemini returned invalid FAQ JSON"); }
  if (typeof parsed.title !== "string" || !parsed.title.trim() || parsed.title.trim().length > 200) throw new Error("Gemini returned an invalid FAQ title");
  if (typeof parsed.content !== "string" || !parsed.content.trim() || parsed.content.trim().length > 10_000) throw new Error("Gemini returned invalid FAQ content");
  const tags = Array.isArray(parsed.tags) ? [...new Set(parsed.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim()) && tag.trim().length <= 50).map((tag) => tag.trim().toLowerCase()))].slice(0, 20) : [];
  return { title: parsed.title.trim(), content: parsed.content.trim(), tags, isPublished: false };
};

export const generateFaqDraft = async (rawTopic: unknown, config: GeminiConfig = {}): Promise<FaqDraft> => {
  const topic = cleanTopic(rawTopic);
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return buildFaqFallback(topic);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const model = config.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const response = await (config.fetchImpl ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `Create a concise Vietnamese support FAQ draft about: ${topic}. Use only general, non-policy-specific guidance. Return JSON only: {"title":"...","content":"...","tags":["..."]}. Never claim actions were completed or invent policies.` }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1200, responseMimeType: "application/json" } }),
    });
    if (!response.ok) return buildFaqFallback(topic);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    return raw ? parseFaqDraft(raw) : buildFaqFallback(topic);
  } catch { return buildFaqFallback(topic); } finally { clearTimeout(timeout); }
};

export const sanitizeCitations = (citations: unknown): PublicCitation[] => Array.isArray(citations)
  ? citations.flatMap((citation) => {
    if (!citation || typeof citation !== "object") return [];
    const item = citation as Partial<KnowledgeCitation>;
    return (item.sourceType === "article" || item.sourceType === "document") && typeof item.title === "string" && item.title.trim()
      ? [{ sourceType: item.sourceType, title: item.title.trim().slice(0, 200) }] : [];
  }) : [];

export const safeQueryTerms = (content: string): string[] => {
  if (/@|https?:\/\/|\b\S+\.\S+\b|\d/.test(content)) return [];
  return [...new Set((content.toLocaleLowerCase("vi-VN").match(/\p{L}{3,}/gu) ?? []))].slice(0, 6);
};
