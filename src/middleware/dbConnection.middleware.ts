import { Request, Response, NextFunction } from "express";
import { connectDB } from "../config/database";


export const ensureDbConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await connectDB();
    next();
  } catch (error: any) {
    console.error("Database connection error:", error);
    res.status(503).json({
      success: false,
      message: "Database connection failed. Please try again later.",
    });
  }
};