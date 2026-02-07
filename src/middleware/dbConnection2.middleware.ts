import { Request, Response, NextFunction } from "express";
import { connectDB } from "../config/database";
import { connectRedis } from "../config/redis";

let isConnected = false;

export const ensureDbConnection = async (req: Request, res: Response, next: NextFunction) => {
  if (!isConnected) {
    try {
      await connectDB();
      await connectRedis();
      isConnected = true;
      console.log("DB & Redis connected ✅");
    } catch (err) {
      console.error("DB connection failed:", err);
      return res.status(500).json({ error: "DB connection failed" });
    }
  }
  next();
};
