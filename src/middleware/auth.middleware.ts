import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../types/controller.type";
import sessionService from "../services/session.service";

export interface AuthRequest extends Request {
  user?: JwtPayload;
  token?: string;
}

// Helper to centralize 401 responses
const unauthorized = (res: Response, message: string) =>
  res.status(401).json({ success: false, message });

// -----------------------------
// Singleton Redis check cache (per serverless instance)
// -----------------------------
let verifiedTokensCache = new Map<string, boolean>();

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, "Access token is required");
    }

    const token = authHeader.split(" ")[1];

    // Check if token has been verified in this instance (singleton cache)
    if (!verifiedTokensCache.has(token)) {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // Check session in Redis and update last active
      const sessionValid = await sessionService.verifyAndUpdateSession(decoded.id, token);
      if (!sessionValid) return unauthorized(res, "Session expired or revoked");

      // Cache token verification for this serverless instance
      verifiedTokensCache.set(token, true);

      // Attach user info to request
      req.user = decoded;
      req.token = token;
    } else {
      // Token was already verified in this instance
      // Optionally decode without verifying (faster)
      const decoded = jwt.decode(token) as JwtPayload;
      req.user = decoded;
      req.token = token;
    }

    next();
  } catch (error: any) {
    const message =
      error.name === "TokenExpiredError" ? "Token has expired" : "Invalid token";
    return unauthorized(res, message);
  }
};
