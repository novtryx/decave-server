import express from "express";
import { getTransactionByReference, paystackWebhook, purchaseTicket, validateReferralCode } from "../controllers/purchaseTicket.controller";
import { checkInTicket, resendTicketEmail, verifyTicketPayment } from "../controllers/verifyTicketPayment.controller";

const router = express.Router();

router.post("/purchase", purchaseTicket);
router.post("/resend", resendTicketEmail);  

router.get("/verify/:reference", verifyTicketPayment);
router.get("/check-in", checkInTicket);
router.get("/validate", validateReferralCode);
router.get("/transaction/:reference", getTransactionByReference);

// ⚠️ Keep webhook last — express.raw() can interfere with body parsing above
router.post(
  "/webhook/paystack",
  express.raw({ type: "application/json" }),
  paystackWebhook
);

export default router;