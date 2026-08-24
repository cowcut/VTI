import { Router } from "express";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../controllers/notification.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();
router.use(protect);
router.get("/", listNotifications);
router.patch("/:id/read", markNotificationRead);
router.post("/read-all", markAllNotificationsRead);
export default router;
