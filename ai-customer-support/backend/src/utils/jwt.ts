import * as jwt from "jsonwebtoken";

export const signAuthToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ id: userId }, secret, { expiresIn: "7d" });
};

export const verifyAuthToken = (token: string): { id: string } => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.verify(token, secret) as { id: string };
};
