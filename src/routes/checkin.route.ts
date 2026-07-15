import express from "express";
import {
  scanCheckIn,
  manualCheckIn,
  searchAttendees,
  getLiveDoorMetrics,
  getAttendanceExport,
} from "../controllers/checkin.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/scan", authenticate, scanCheckIn);
router.post("/manual", authenticate, manualCheckIn);
router.get("/events/:eventId/search", authenticate, searchAttendees);
router.get("/events/:eventId/live", authenticate, getLiveDoorMetrics);
router.get("/events/:eventId/export", authenticate, getAttendanceExport);

export default router;