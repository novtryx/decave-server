import express from "express";
import {
  createFinanceEntry,
  updateFinanceEntry,
  deleteFinanceEntry,
  getFinanceEntries,
  getEventFinanceSummary,
  getFinanceOverview,
} from "../controllers/finance.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/overview", authenticate, getFinanceOverview);
router.get("/entries", authenticate, getFinanceEntries);
router.post("/entries", authenticate, createFinanceEntry);
router.patch("/entries/:id", authenticate, updateFinanceEntry);
router.delete("/entries/:id", authenticate, deleteFinanceEntry);
router.get("/events/:eventId/summary", authenticate, getEventFinanceSummary);

export default router;