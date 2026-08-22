import express from "express";
import {
  listApplications,
  getApplication,
  updateApplicationStatus,
  getDashboardStats,
  listAllCategories,
  createCategory,
} from "../controllers/openCallAdmin.controller";
import { validateUpdateApplicationStatus, validateCreateCategory } from "../validators/openCall.validation";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.use(authenticate);

router.get("/stats", getDashboardStats);
router.get("/applications", listApplications);
router.get("/applications/:id", getApplication);
router.patch("/applications/:id/status", validateUpdateApplicationStatus, updateApplicationStatus);

router.get("/categories", listAllCategories);
router.post("/categories", validateCreateCategory, createCategory);

export default router;