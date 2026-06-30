import express from "express";
import { getDashboardAnalytics } from "../controllers/analytics.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();


router.get("/", getDashboardAnalytics);


export default router;