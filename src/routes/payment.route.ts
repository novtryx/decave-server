import express from "express";
import { purchaseTicket } from "../controllers/purchaseTicket.controller";
import { checkInTicket, verifyTicketPayment } from "../controllers/verifyTicketPayment.controller";

const router = express.Router();

router.post("/purchase", purchaseTicket);
router.get("/verify/:reference", verifyTicketPayment);
router.get("/check-in", checkInTicket);


export default router;