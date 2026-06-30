import { Request, Response } from "express"; // or Next.js API types
import { AnalyticsService } from "../services/analytics.service";
import { parseDashboardRange } from "../utils/daterange";

const analyticsService = new AnalyticsService();

export const getDashboardAnalytics = async (req: Request, res: Response) => {
  try {
    const range = parseDashboardRange(req.query.range);
    const dashboard = await analyticsService.getAllAnalytics(range);
    return res.status(200).json({ success: true, data: dashboard });
  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};