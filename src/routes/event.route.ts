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
  getEventByTitle,
  updateEventTicket,
  createEventTicket,
  sendEventFeedbackRequest,
} from "../controllers/event.controller";
import {
  validateCreateEvent,
  validateUpdateEvent,
  validateEventStage,
  validateCreateTicket,
  validateUpdateTicket,
  validateSendFeedbackRequest,
  parseMultipartEventFields,
} from "../validators/event.validation";
import { authenticate } from "../middleware/auth.middleware";
import { uploadSingleImage } from "../middleware/upload.middleware";

const router = express.Router();

// Public routes
router.get("/published", getPublishedEvents);
router.get("/upcoming", getUpcomingEvents);
router.get("/past", getPastEvents);
router.get("/search", searchEvents);
router.get("/stats", authenticate, getEventStats);

router.get("/:id", getEventById);

// Protected routes (require authentication)
router.post(
  "/",
  authenticate,
  uploadSingleImage,
  parseMultipartEventFields,
  validateCreateEvent,
  createEvent
);

router.get("/", getAllEvents);
router.get("/eventTitle/:eventTitle", getEventByTitle);

router.put(
  "/:id",
  authenticate,
  validateUpdateEvent,
  updateEvent
);

router.post(
  "/create-ticket/:eventId",
  authenticate,
  validateCreateTicket,
  createEventTicket
);


router.patch(
  "/:id/stage",
  authenticate,
  validateEventStage,
  updateEventStage
);

router.patch(
  "/:eventId/tickets/:ticketId",
  authenticate,
  validateUpdateTicket,
  updateEventTicket
);


router.delete("/:id", authenticate, deleteEvent);

router.patch("/:id/publish", authenticate, publishEvent);

router.patch("/:id/unpublish", authenticate, unpublishEvent);

router.post(
  "/:id/send-feedback-request",
  authenticate,
  validateSendFeedbackRequest,
  sendEventFeedbackRequest
);

export default router;