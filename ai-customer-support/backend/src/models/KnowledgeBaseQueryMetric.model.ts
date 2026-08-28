import { Document, model, Schema } from "mongoose";

export interface IKnowledgeBaseQueryMetric extends Document {
  terms: string[];
  count: number;
  lastSeenAt: Date;
}

const knowledgeBaseQueryMetricSchema = new Schema<IKnowledgeBaseQueryMetric>({
  terms: { type: [String], required: true },
  count: { type: Number, required: true, default: 1, min: 1 },
  lastSeenAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

knowledgeBaseQueryMetricSchema.index({ terms: 1 }, { unique: true });

export const KnowledgeBaseQueryMetric = model<IKnowledgeBaseQueryMetric>("KnowledgeBaseQueryMetric", knowledgeBaseQueryMetricSchema);
