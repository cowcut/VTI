import { VerifiedSupportTools } from "./support-tools.service";
import { KnowledgeCitation } from "./knowledge-base-enhancements.service";

type PromptMessage = { senderType: string; content: string };
type KnowledgeArticle = { title: string; content: string; tags?: string[]; citation?: KnowledgeCitation };

type GeminiConfig = { apiKey?: string; model?: string; fetchImpl?: typeof fetch };

// Gemini can take longer than the old 12s budget under production load.
// Keep the cap bounded while allowing one grounded response to complete.
export const GEMINI_REPLY_TIMEOUT_MS = 25_000;

export const shouldGenerateAiReply = ({ senderType, mode }: { senderType: string; mode: string }) => senderType === "customer" && mode === "ai";

export type GeminiSupportReply = { content: string; requiresHuman: boolean; confidence?: number; sentiment?: "positive" | "neutral" | "negative"; citations?: KnowledgeCitation[] };

export const parseGeminiSupportReply = (text: string): GeminiSupportReply => {
  let parsed: { reply?: unknown; requiresHuman?: unknown; confidence?: unknown; sentiment?: unknown };
  try { parsed = JSON.parse(text); } catch { throw new Error("Gemini returned invalid JSON"); }
  if (typeof parsed.reply !== "string" || !parsed.reply.trim() || typeof parsed.requiresHuman !== "boolean") throw new Error("Gemini returned an invalid support reply");
  const reply: GeminiSupportReply = { content: parsed.reply.trim().slice(0, 5000), requiresHuman: parsed.requiresHuman };
  if (typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence) && parsed.confidence >= 0 && parsed.confidence <= 1) reply.confidence = parsed.confidence;
  if (parsed.sentiment === "positive" || parsed.sentiment === "neutral" || parsed.sentiment === "negative") reply.sentiment = parsed.sentiment;
  return reply;
};

export const buildSupportPrompt = ({ subject, messages, knowledge = [], toolContext }: { subject?: string; messages: PromptMessage[]; knowledge?: KnowledgeArticle[]; toolContext?: VerifiedSupportTools | null }) => {
  const history = messages.slice(-12).map((message) => `${message.senderType.toUpperCase()}: ${message.content.slice(0, 1000)}`).join("\n");
  const knowledgeContext = knowledge.slice(0, 5).map((article) => `Tiêu đề: ${article.title.slice(0, 200)}\nNội dung: ${article.content.slice(0, 1200)}`).join("\n\n");
  const verifiedTools = toolContext ? JSON.stringify(toolContext) : "Không có dữ liệu đã xác minh.";
  return [
    "Bạn là trợ lý hỗ trợ khách hàng cho một ứng dụng phần mềm.",
    "Trả lời bằng tiếng Việt, lịch sự, ngắn gọn và hữu ích.",
    "Dùng thông tin trong lịch sử hội thoại và Knowledge Base liên quan được cung cấp bên dưới, cùng dữ liệu công cụ đã xác minh. Không được bịa chính sách, trạng thái đơn hàng, dữ liệu tài khoản hoặc thao tác đã thực hiện.",
    "Với lời chào, xác nhận đã nhận yêu cầu, hướng dẫn sử dụng chung hoặc câu hỏi làm rõ không chứa cam kết sản phẩm, bạn có thể tự trả lời khi không cần Knowledge Base. Với chính sách, giá, hoàn tiền, đổi trả, giao hàng, đơn hàng, tài khoản hoặc dữ liệu riêng, chỉ trả lời khi có Knowledge Base hoặc dữ liệu công cụ phù hợp; nếu không hãy chuyển cho nhân viên.",
    "Dữ liệu công cụ là dữ liệu đã xác minh duy nhất; không suy diễn thêm và không yêu cầu hoặc dùng URL bên ngoài.",
    "Nếu thiếu thông tin, khách yêu cầu nhân viên, hoặc bạn không chắc chắn, hãy đặt requiresHuman là true.",
    "Chỉ trả JSON hợp lệ theo dạng: {\"reply\":\"câu trả lời cho khách\",\"requiresHuman\":true hoặc false,\"confidence\":0 đến 1,\"sentiment\":\"positive|neutral|negative\"}. confidence và sentiment là tùy chọn. Không thêm Markdown hoặc văn bản ngoài JSON.",
    `Chủ đề ticket: ${subject || "Yêu cầu hỗ trợ"}`,
    "Knowledge Base liên quan (chỉ dùng khi phù hợp):",
    knowledgeContext || "Không có bài viết liên quan.",
    "Dữ liệu công cụ đã xác minh:",
    verifiedTools,
    "Lịch sử hội thoại:",
    history || "Chưa có tin nhắn trước đó.",
  ].join("\n\n");
};

export const generateGeminiReply = async (input: { subject?: string; messages: PromptMessage[]; knowledge?: KnowledgeArticle[]; toolContext?: VerifiedSupportTools | null }, config: GeminiConfig = {}): Promise<GeminiSupportReply | null> => {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = config.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const fetchImpl = config.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_REPLY_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: buildSupportPrompt(input) }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: "application/json" } }), signal: controller.signal });
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const rawReply = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!rawReply) throw new Error("Gemini returned no text response");
    const reply = parseGeminiSupportReply(rawReply);
    const citations = input.knowledge?.flatMap((item) => item.citation ? [item.citation] : []) ?? [];
    return citations.length ? { ...reply, citations } : reply;
  } finally { clearTimeout(timeout); }
};
