import rateLimit from "express-rate-limit";

export const rateLimitPolicies = {
  auth: { windowMs: 15 * 60 * 1000, limit: 10 },
  register: { windowMs: 60 * 60 * 1000, limit: 5 },
  message: { windowMs: 60 * 1000, limit: 15 },
} as const;

const createLimiter = (policy: { windowMs: number; limit: number }, message: string) =>
  rateLimit({
    ...policy,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message },
  });

export const loginRateLimiter = createLimiter(
  rateLimitPolicies.auth,
  "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.",
);

export const registerRateLimiter = createLimiter(
  rateLimitPolicies.register,
  "Bạn đã tạo tài khoản quá nhiều lần. Vui lòng thử lại sau 1 giờ.",
);

export const messageRateLimiter = createLimiter(
  rateLimitPolicies.message,
  "Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau 1 phút.",
);
