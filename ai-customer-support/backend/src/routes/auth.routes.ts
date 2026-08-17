import { Router } from "express";
import { login, me, register } from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";
import { loginRateLimiter, registerRateLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.get("/me", protect, me);

export default router;
