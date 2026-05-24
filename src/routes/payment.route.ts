import express from "express";
import { getTransactionByReference, paystackWebhook, purchaseTicket, validateReferralCode } from "../controllers/purchaseTicket.controller";
import { checkInTicket, verifyTicketPayment } from "../controllers/verifyTicketPayment.controller";

const router = express.Router();

router.post("/purchase", purchaseTicket);
router.post(
  "/webhook/paystack",
  express.raw({ type: "application/json" }),
  paystackWebhook
);

router.get("/verify/:reference", verifyTicketPayment);
router.get("/check-in", checkInTicket);
router.get("/validate", validateReferralCode)
router.get("/transaction/:reference", getTransactionByReference);



export default router;