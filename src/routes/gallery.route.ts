import express from "express";
import multer from "multer";
import GalleryController from "../controllers/gallery.controller";

const router = express.Router();
const upload = multer(); // memory storage for buffer

router.post("/create", upload.single("file"), GalleryController.create); // Create
router.get("/type/:type", GalleryController.getByType);                  // Get by type
router.get("/event/:eventId", GalleryController.getByEvent);             // Get by event
router.get("/featured", GalleryController.getFeatured);        // Get featured (optionally by event)
router.get("/events", GalleryController.getEvent)

export default router; 