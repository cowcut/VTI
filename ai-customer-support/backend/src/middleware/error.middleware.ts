import { NextFunction, Request, Response } from "express";
import multer from "multer";

export const notFound = (req: Request, res: Response) => {
  return res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(error);
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "Attachment must be 5 MB or smaller" });
  }
  return res.status(500).json({ success: false, message: "Internal server error" });
};
