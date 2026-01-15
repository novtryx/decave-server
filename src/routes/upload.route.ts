import express from "express";
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleVideo,
  deleteImage,
  deleteVideo,
} from "../controllers/upload.controller";
import {
  uploadSingleImage as uploadSingleImageMiddleware,
  uploadMultipleImages as uploadMultipleImagesMiddleware,
  uploadSingleVideo as uploadSingleVideoMiddleware,
} from "../middleware/upload.middleware";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

// Image routes
router.post(
  "/image",
  authenticate,
  uploadSingleImageMiddleware,
  uploadSingleImage
);

router.post(
  "/images",
  authenticate,
  uploadMultipleImagesMiddleware,
  uploadMultipleImages
);

// Video routes
router.post(
  "/video",
  authenticate,
  uploadSingleVideoMiddleware,
  uploadSingleVideo
);

// Delete routes
router.delete("/image", authenticate, deleteImage);
router.delete("/video", authenticate, deleteVideo);

export default router;