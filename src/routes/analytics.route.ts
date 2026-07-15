import express from "express";
import {
  getDashboardAnalytics,
  getEventAnalytics,
  compareEventAnalytics,
} from "../controllers/analytics.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();


router.get("/", getDashboardAnalytics);

// NOTE: /events/compare must be registered before /events/:eventId,
// otherwise Express will match "compare" as an :eventId param.
router.get("/events/compare", authenticate, compareEventAnalytics);
router.get("/events/:eventId", authenticate, getEventAnalytics);


export default router;