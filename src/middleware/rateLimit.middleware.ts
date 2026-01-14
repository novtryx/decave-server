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
