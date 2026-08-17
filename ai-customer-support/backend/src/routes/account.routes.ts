import { Router } from "express";
import { listAccounts, updateAccount } from "../controllers/account.controller";
import { protect } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";

const router = Router();

router.use(protect, requireAdmin);
router.get("/", listAccounts);
router.patch("/:id", updateAccount);

export default router;
