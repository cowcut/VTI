import { Router } from "express";
import { getOperationalTicketAnalytics } from "../controllers/operations.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);
router.get("/tickets", getOperationalTicketAnalytics);

export default router;
