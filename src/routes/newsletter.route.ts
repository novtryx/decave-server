import { Router } from "express";
import { getAllSubscribedEmail, sendNewsletter, subscribeToNewsletter, unsubscribeFromNewsletter } from "../controllers/newsletter.controller";

const router = Router();

router.post("/", subscribeToNewsletter);
router.get("/emails", getAllSubscribedEmail);
router.post("/send-email", sendNewsletter)
router.delete("/", unsubscribeFromNewsletter);



export default router; 