export type SecurityEnvironment = {
  nodeEnv?: string;
  corsOrigins?: string;
};

const localOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
]);

export const isProduction = (nodeEnv?: string): boolean => nodeEnv === "production";

export const getAllowedOrigins = (corsOrigins?: string): string[] =>
  (corsOrigins || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const getCorsOptions = ({ nodeEnv, corsOrigins }: SecurityEnvironment) => {
  const production = isProduction(nodeEnv);
  const allowedOrigins = new Set(getAllowedOrigins(corsOrigins));

  if (production && allowedOrigins.size === 0) {
    throw new Error("CORS_ORIGINS must list at least one frontend origin in production");
  }

  return {
    credentials: false,
    origin: (origin: string | undefined): boolean => {
      if (!origin) return true;
      if (allowedOrigins.has(origin)) return true;
      return !production && localOrigins.has(origin);
    },
  };
};
