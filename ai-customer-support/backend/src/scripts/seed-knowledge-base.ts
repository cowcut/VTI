import dotenv from "dotenv";
import { connectDatabase } from "../config/database";
import { KnowledgeBaseArticle } from "../models/KnowledgeBaseArticle.model";
import { defaultKnowledgeBaseArticles } from "../services/default-knowledge-base.service";

dotenv.config();

const seedKnowledgeBase = async () => {
  await connectDatabase();
  let created = 0;
  for (const article of defaultKnowledgeBaseArticles) {
    const result = await KnowledgeBaseArticle.updateOne(
      { title: article.title },
      { $setOnInsert: article },
      { upsert: true },
    );
    if (result.upsertedCount) created += 1;
  }
  console.log(`Knowledge Base seed complete: ${created} created, ${defaultKnowledgeBaseArticles.length - created} already present.`);
  process.exit(0);
};

seedKnowledgeBase().catch((error) => {
  console.error("Knowledge Base seed failed:", error);
  process.exit(1);
});
