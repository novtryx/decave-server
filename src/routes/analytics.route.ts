import express from "express";
import { getDashboardAnalytics } from "../controllers/analytics.controller";

const router = express.Router();


router.get("/", getDashboardAnalytics);


export default router;