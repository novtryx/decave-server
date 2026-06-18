import express from "express";
import { resendTicketEmail } from "../controllers/verifyTicketPayment.controller";

const router = express.Router();
router.post("/", resendTicketEmail);  

export default router;