import { Router } from "express";
import { getAllSubscribedEmail, sendNewsletter, subscribeToNewsletter, syncOpenCallApplicantsToNewsletter, unsubscribeFromNewsletter } from "../controllers/newsletter.controller";

const router = Router();

router.post("/", subscribeToNewsletter);
router.get("/emails", getAllSubscribedEmail);
router.post("/send-email", sendNewsletter)
router.delete("/", unsubscribeFromNewsletter);

// Public, no-auth — just open/ping this URL (GET) and every open-call
// applicant email gets auto-subscribed to the newsletter.
router.get("/sync-open-call-applicants", syncOpenCallApplicantsToNewsletter);



export default router;