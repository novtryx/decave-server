import express from "express";
import {
  getDashboardAnalytics,
  getEventAnalytics,
  compareEventAnalytics,
  getEventTrafficSources,
} from "../controllers/analytics.controller";
import { trackPageVisit } from "../controllers/pageVisit.controller";
import { authenticate } from "../middleware/auth.middleware";
import { pageVisitRateLimiter } from "../middleware/rateLimit.middleware";

const router = express.Router();


router.get("/", getDashboardAnalytics);

// NOTE: /events/compare must be registered before /events/:eventId,
// otherwise Express will match "compare" as an :eventId param.
router.get("/events/compare", authenticate, compareEventAnalytics);
router.get("/events/:eventId", authenticate, getEventAnalytics);
router.get("/events/:eventId/sources", authenticate, getEventTrafficSources);

// Public — called from the event page on every visit, so it's
// rate-limited per IP rather than behind auth.
router.post("/track-visit", pageVisitRateLimiter, trackPageVisit);


export default router;