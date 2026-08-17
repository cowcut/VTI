import { NextFunction, Request, Response } from "express";

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
  return res.status(500).json({ success: false, message: "Internal server error" });
};
