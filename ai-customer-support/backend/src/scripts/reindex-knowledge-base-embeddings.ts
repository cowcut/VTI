import dotenv from "dotenv";
import mongoose, { Types } from "mongoose";
import { connectDatabase } from "../config/database";
import { KnowledgeBaseArticle } from "../models/KnowledgeBaseArticle.model";
import { KnowledgeBaseChunk } from "../models/KnowledgeBaseChunk.model";
import { KnowledgeBaseDocument } from "../models/KnowledgeBaseDocument.model";
import { embedTextWithGemini } from "../services/knowledge-base.service";

export const mapWithConcurrency = async <T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> => {
  const output = new Array<R>(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      output[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return output;
};

const boundedPositiveInteger = (value: string | undefined, fallback: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

const embeddingText = (title: string, content: string, tags: string[] = []) => [title, ...tags, content].filter(Boolean).join("\n");

type ReindexCounts = { attempted: number; updated: number; failed: number };

const reindexBatch = async (
  records: Array<{ _id: Types.ObjectId; text: string }>,
  collection: "article" | "chunk",
  concurrency: number,
): Promise<ReindexCounts> => {
  const results = await mapWithConcurrency(records, concurrency, async (record) => {
    const embedding = await embedTextWithGemini(record.text);
    if (!embedding) return false;
    if (collection === "article") await KnowledgeBaseArticle.updateOne({ _id: record._id }, { $set: { embedding } });
    else await KnowledgeBaseChunk.updateOne({ _id: record._id }, { $set: { embedding } });
    return true;
  });
  const updated = results.filter(Boolean).length;
  return { attempted: records.length, updated, failed: records.length - updated };
};

const addCounts = (left: ReindexCounts, right: ReindexCounts): ReindexCounts => ({
  attempted: left.attempted + right.attempted,
  updated: left.updated + right.updated,
  failed: left.failed + right.failed,
});

export const reindexKnowledgeBaseEmbeddings = async (concurrency = boundedPositiveInteger(process.env.REINDEX_CONCURRENCY, 2, 4), batchSize = boundedPositiveInteger(process.env.REINDEX_BATCH_SIZE, 25, 50)) => {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required to reindex Knowledge Base embeddings");
  let counts: ReindexCounts = { attempted: 0, updated: 0, failed: 0 };
  let afterId: Types.ObjectId | undefined;
  do {
    const filter = afterId ? { isPublished: true, _id: { $gt: afterId } } : { isPublished: true };
    const articles = await KnowledgeBaseArticle.find(filter).sort({ _id: 1 }).limit(batchSize).select("_id title content tags").lean();
    if (!articles.length) break;
    afterId = articles[articles.length - 1]._id;
    counts = addCounts(counts, await reindexBatch(articles.map((article) => ({ _id: article._id, text: embeddingText(article.title, article.content, article.tags) })), "article", concurrency));
  } while (afterId);

  const documents = await KnowledgeBaseDocument.find({ isPublished: true, archivedAt: null }).select("_id title tags").lean();
  for (const document of documents) {
    let chunkAfterId: Types.ObjectId | undefined;
    do {
      const filter = chunkAfterId ? { source: document._id, _id: { $gt: chunkAfterId } } : { source: document._id };
      const chunks = await KnowledgeBaseChunk.find(filter).sort({ _id: 1 }).limit(batchSize).select("_id content").lean();
      if (!chunks.length) break;
      chunkAfterId = chunks[chunks.length - 1]._id;
      counts = addCounts(counts, await reindexBatch(chunks.map((chunk) => ({ _id: chunk._id, text: embeddingText(document.title, chunk.content, document.tags) })), "chunk", concurrency));
    } while (chunkAfterId);
  }
  return counts;
};

const run = async () => {
  dotenv.config();
  await connectDatabase();
  try {
    const counts = await reindexKnowledgeBaseEmbeddings();
    console.log(`Knowledge Base embedding reindex complete: attempted=${counts.attempted}, updated=${counts.updated}, failed=${counts.failed}`);
    if (counts.failed) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  run().catch((error: unknown) => {
    console.error("Knowledge Base embedding reindex failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
