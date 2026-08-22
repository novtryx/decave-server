import express from "express";
import {
  listCategories,
  getCategory,
  startApplication,
  getApplicationByToken,
  saveApplicationProgress,
  uploadApplicationFileMiddleware,
  uploadApplicationFile,
  submitApplication,
} from "../controllers/openCallPublic.controller";
import { validateStartApplication, validateSaveProgress } from "../validators/openCall.validation";
import { openCallRateLimiter } from "../middleware/rateLimit.middleware";

const router = express.Router();

router.use(openCallRateLimiter);

// Category configs — power the dynamic form. /categories/:slug also
// serves the QR-code preselect flow (spec section 21: /apply/:slug).
router.get("/categories", listCategories);
router.get("/categories/:slug", getCategory);

// Application lifecycle — no auth, identity is the resumeToken itself.
router.post("/start", validateStartApplication, startApplication);
router.get("/resume/:token", getApplicationByToken);
router.patch("/:token", validateSaveProgress, saveApplicationProgress);
router.post("/:token/upload", uploadApplicationFileMiddleware, uploadApplicationFile);
router.post("/:token/submit", submitApplication);

export default router;