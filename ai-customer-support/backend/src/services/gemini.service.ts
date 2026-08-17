type PromptMessage = { senderType: string; content: string };

type GeminiConfig = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export const shouldGenerateAiReply = ({ senderType, mode }: { senderType: string; mode: string }) =>
  senderType === "customer" && mode === "ai";

type GeminiSupportReply = { content: string; requiresHuman: boolean };

export const parseGeminiSupportReply = (text: string): GeminiSupportReply => {
  let parsed: { reply?: unknown; requiresHuman?: unknown };
  try { parsed = JSON.parse(text); } catch { throw new Error("Gemini returned invalid JSON"); }
  if (typeof parsed.reply !== "string" || !parsed.reply.trim() || typeof parsed.requiresHuman !== "boolean") {
    throw new Error("Gemini returned an invalid support reply");
  }
  return { content: parsed.reply.trim().slice(0, 5000), requiresHuman: parsed.requiresHuman };
};

export const buildSupportPrompt = ({ subject, messages }: { subject?: string; messages: PromptMessage[] }) => {
  const history = messages.slice(-12).map((message) => `${message.senderType.toUpperCase()}: ${message.content}`).join("\n");
  return [
    "Bạn là trợ lý hỗ trợ khách hàng cho một ứng dụng phần mềm.",
    "Trả lời bằng tiếng Việt, lịch sự, ngắn gọn và hữu ích.",
    "Chỉ dùng thông tin trong lịch sử hội thoại. Không được bịa chính sách, trạng thái đơn hàng, dữ liệu tài khoản hoặc thao tác đã thực hiện.",
    "Nếu thiếu thông tin, khách yêu cầu nhân viên, hoặc bạn không chắc chắn, hãy đặt requiresHuman là true.",
    "Chỉ trả JSON hợp lệ theo dạng: {\"reply\":\"câu trả lời cho khách\",\"requiresHuman\":true hoặc false}. Không thêm Markdown hoặc văn bản ngoài JSON.",
    `Chủ đề ticket: ${subject || "Yêu cầu hỗ trợ"}`,
    "Lịch sử hội thoại:",
    history || "Chưa có tin nhắn trước đó.",
  ].join("\n\n");
};

export const generateGeminiReply = async (
  input: { subject?: string; messages: PromptMessage[] },
  config: GeminiConfig = {},
): Promise<GeminiSupportReply | null> => {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = config.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const fetchImpl = config.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildSupportPrompt(input) }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500, responseMimeType: "application/json" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const rawReply = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!rawReply) throw new Error("Gemini returned no text response");
    return parseGeminiSupportReply(rawReply);
  } finally {
    clearTimeout(timeout);
  }
};
