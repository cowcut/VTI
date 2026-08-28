import { Document, model, Schema, Types } from "mongoose";

export interface IKnowledgeBaseChunk extends Document {
  source: Types.ObjectId;
  position: number;
  content: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeBaseChunkSchema = new Schema<IKnowledgeBaseChunk>(
  {
    source: { type: Schema.Types.ObjectId, ref: "KnowledgeBaseDocument", required: true, index: true },
    position: { type: Number, required: true, min: 0 },
    content: { type: String, required: true, trim: true, maxlength: 800 },
    embedding: {
      type: [Number],
      default: undefined,
      select: false,
      validate: { validator: (values: number[] | undefined) => !values || (values.length === 768 && values.every(Number.isFinite)), message: "embedding must be a finite 768-dimensional vector" },
    },
  },
  { timestamps: true },
);

knowledgeBaseChunkSchema.index({ source: 1, position: 1 }, { unique: true });
knowledgeBaseChunkSchema.index({ content: "text" });

export const KnowledgeBaseChunk = model<IKnowledgeBaseChunk>("KnowledgeBaseChunk", knowledgeBaseChunkSchema);
