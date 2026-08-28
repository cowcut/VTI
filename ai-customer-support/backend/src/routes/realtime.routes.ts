import { Router } from "express";
import { streamRealtimeEvents } from "../controllers/realtime.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();
router.use(protect);
router.get("/events", streamRealtimeEvents);

export default router;
