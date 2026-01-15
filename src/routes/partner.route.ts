import express from "express";
import {
  createPartner,
  getPartnerById,
  getAllPartners,
  updatePartner,
  deletePartner,
  addEventToPartner,
  removeEventFromPartner,
  searchPartners,
  getPartnerStats,
  updateVisibilityControl,
} from "../controllers/partner.controller";
import {
  validateCreatePartner,
  validateUpdatePartner,
  validateAddEvent,
} from "../validators/partner.validation";
import { authenticate } from "../middleware/auth.middleware";
import { uploadSingleImage } from "../middleware/upload.middleware";

const router = express.Router();


router.get("/search", searchPartners);
router.get("/:id", getPartnerById);

// Protected routes (require authentication)
router.post(
  "/",
  authenticate,
  uploadSingleImage,
  validateCreatePartner,
  createPartner
);

router.get("/", getAllPartners);

router.put(
  "/:id",
  authenticate,
  uploadSingleImage,
  validateUpdatePartner,
  updatePartner
);

router.delete("/:id", authenticate, deletePartner);


router.post(
  "/:id/events",
  authenticate,
  validateAddEvent,
  addEventToPartner
);

router.delete("/:id/events/:eventId", authenticate, removeEventFromPartner);

router.get("/stats/overview", authenticate, getPartnerStats);

router.patch(
  "/:id/visibility",
  authenticate,
  updateVisibilityControl
);

export default router;