import { Document, model, Schema } from "mongoose";

export interface IKnowledgeBaseDocument extends Document {
  title: string;
  content: string;
  tags: string[];
  isPublished: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeBaseDocumentSchema = new Schema<IKnowledgeBaseDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 50_000 },
    tags: { type: [String], default: [], maxlength: 20 },
    isPublished: { type: Boolean, default: true, index: true },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export const KnowledgeBaseDocument = model<IKnowledgeBaseDocument>("KnowledgeBaseDocument", knowledgeBaseDocumentSchema);
