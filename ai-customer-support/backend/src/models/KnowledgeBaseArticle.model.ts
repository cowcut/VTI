import { Document, model, Schema } from "mongoose";

export interface IKnowledgeBaseArticle extends Document {
  title: string;
  content: string;
  tags: string[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeBaseArticleSchema = new Schema<IKnowledgeBaseArticle>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 10_000 },
    tags: { type: [String], default: [], maxlength: 20 },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

knowledgeBaseArticleSchema.index({ title: "text", content: "text", tags: "text" });

export const KnowledgeBaseArticle = model<IKnowledgeBaseArticle>("KnowledgeBaseArticle", knowledgeBaseArticleSchema);
