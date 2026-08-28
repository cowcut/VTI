const test = require("node:test");
const assert = require("node:assert/strict");

const {
  GEMINI_STREAM_TIMEOUT_MS,
  streamGeminiSupportReply,
} = require("../../dist/services/gemini-streaming.service.js");

const streamResponse = (chunks, status = 200) => new Response(
  new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  }),
  { status },
);

const collect = async (stream) => {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
};

const withGeminiKey = async (run) => {
  const original = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "server-only-test-key";
  try {
    return await run();
  } finally {
    if (original === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original;
  }
};

test("streaming emits fixed safe progress then validates the complete final reply", async () => {
  await withGeminiKey(async () => {
    const events = await collect(streamGeminiSupportReply(
      { subject: "Help", messages: [{ senderType: "customer", content: "I need help" }] },
      {
        model: "test model",
        fetchImpl: async (url, options) => {
          assert.match(url, /:streamGenerateContent\?alt=sse&key=server-only-test-key$/);
          assert.equal(options.signal.aborted, false);
          return streamResponse([
            'data: {"candidates":[{"content":{"parts":[{"text":"{\\\"reply\\\":\\\"Hello"}]}}]}\n\n',
            'data: {"candidates":[{"content":{"parts":[{"text":" there\\\",\\\"requiresHuman\\\":false}"}]}}]}\n\n',
          ]);
        },
      },
    ));

    assert.deepEqual(events, [
      { type: "progress", message: "Generating support reply…" },
      { type: "final", reply: { content: "Hello there", requiresHuman: false } },
    ]);
  });
});

test("streaming never yields provider text before a complete valid structured reply", async () => {
  await withGeminiKey(async () => {
    const stream = streamGeminiSupportReply(
      { messages: [{ senderType: "customer", content: "Need order help" }] },
      { fetchImpl: async () => streamResponse(['data: {"candidates":[{"content":{"parts":[{"text":"Unvalidated customer text"}]}}]}\n\n']) },
    );

    assert.deepEqual(await stream.next(), { value: { type: "progress", message: "Generating support reply…" }, done: false });
    await assert.rejects(stream.next(), /invalid JSON/);
  });
});

test("streaming keeps its provider timeout bounded even when callers pass options", async () => {
  await withGeminiKey(async () => {
    const originalSetTimeout = global.setTimeout;
    let timeoutDelay;
    global.setTimeout = (callback, delay) => {
      timeoutDelay = delay;
      return originalSetTimeout(callback, 60_000);
    };
    try {
      const stream = streamGeminiSupportReply(
        { messages: [{ senderType: "customer", content: "Hello" }] },
        { timeoutMs: 999_999, fetchImpl: async () => streamResponse(['data: {"candidates":[{"content":{"parts":[{"text":"{\\\"reply\\\":\\\"Hi\\\",\\\"requiresHuman\\\":false}"}]}}]}\n\n']) },
      );
      await collect(stream);
      assert.equal(timeoutDelay, GEMINI_STREAM_TIMEOUT_MS);
    } finally {
      global.setTimeout = originalSetTimeout;
    }
  });
});
