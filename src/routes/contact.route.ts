import express from "express";
import { submitInquiry } from "../controllers/contact.controller";
import { validateSubmitInquiry } from "../validators/contact.validation";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Public, unauthenticated — a contact form is a classic spam/abuse
// target, so this gets its own tight-ish limiter rather than reusing
// the more generous open-call one (which expects legitimate repeat
// hits from someone filling out a multi-step form).
const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many messages sent. Please try again in a little while.",
  },
});

router.post("/", contactRateLimiter, validateSubmitInquiry, submitInquiry);

export default router;