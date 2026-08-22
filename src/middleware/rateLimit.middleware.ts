import rateLimit from 'express-rate-limit';


/**
 * Factory function to create a rate limiter.
 * Ensures Redis is connected before using it.
 */


export const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again after 5 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // No store specified = uses default memory store
});

// Public, unauthenticated, hit once per real page load — generous
// ceiling since a single visitor loading multiple event pages is
// normal, but still caps scripted/bot flooding of the visits table.
export const pageVisitRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // Tracking is best-effort — never surface a 429 as a visible error,
  // just drop the beat silently.
  handler: (_req, res) => {
    res.status(200).json({ success: false });
  },
});

// Public — applicant-facing open call flow. Looser than the visit
// tracker since a real applicant legitimately hits save-progress
// multiple times while moving through a multi-step form, and file
// uploads count as separate requests too.
export const openCallRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please slow down and try again shortly.",
  },
});