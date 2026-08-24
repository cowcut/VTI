import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import conversationRoutes from "./routes/conversation.routes";
import accountRoutes from "./routes/account.routes";
import knowledgeBaseRoutes from "./routes/knowledge-base.routes";
import notificationRoutes from "./routes/notification.routes";
import { errorHandler, notFound } from "./middleware/error.middleware";
import { getCorsOptions } from "./config/security";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const corsOptions = getCorsOptions({
  nodeEnv: process.env.NODE_ENV,
  corsOrigins: process.env.CORS_ORIGINS,
});

app.use(cors({
  credentials: corsOptions.credentials,
  origin: (origin, callback) => callback(null, corsOptions.origin(origin)),
}));
app.use(helmet());
app.use(morgan("dev"));

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/knowledge-base", knowledgeBaseRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "AI Customer Support API is running",
  });
});

app.use(notFound);
app.use(errorHandler);

export default app;