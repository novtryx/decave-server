import express from "express"
import { authenticate } from "../middleware/auth.middleware";
import { dashboardData } from "../controllers/dasshboard.controller";
const router = express.Router()

router.get("/", authenticate, dashboardData)


export default router;