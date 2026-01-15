import express from "express";
import {
  createEvent,
  getEventById,
  getAllEvents,
  updateEvent,
  updateEventStage,
  deleteEvent,
  publishEvent,
  unpublishEvent,
  getPublishedEvents,
  searchEvents,
  getUpcomingEvents,
  getPastEvents,
  getEventStats,
} from "../controllers/event.controller";
import {
  validateCreateEvent,
  validateUpdateEvent,
} from "../validators/event.validation";
import { authenticate } from "../middleware/auth.middleware";
import { uploadSingleImage } from "../middleware/upload.middleware";

const router = express.Router();

// Public routes
router.get("/published", getPublishedEvents);
router.get("/upcoming", getUpcomingEvents);
router.get("/past", getPastEvents);
router.get("/search", searchEvents);

router.get("/:id", getEventById);

// Protected routes (require authentication)
router.post(
  "/",
  authenticate,
  uploadSingleImage,
  validateCreateEvent,
  createEvent
);

router.get("/", getAllEvents);

router.put(
  "/:id",
  authenticate,
  validateUpdateEvent,
  updateEvent
);

router.patch(
  "/:id/stage",
  authenticate,
  updateEventStage
);

router.delete("/:id", authenticate, deleteEvent);

router.patch("/:id/publish", authenticate, publishEvent);

router.patch("/:id/unpublish", authenticate, unpublishEvent);

router.get("/stats", authenticate, getEventStats);

export default router;