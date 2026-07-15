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

export const getEventAnalytics = async (req: Request, res: Response) => {
  try {
    const eventId = String(req.params.eventId);
    const data = await analyticsService.getEventAnalytics(eventId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching event analytics:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const compareEventAnalytics = async (req: Request, res: Response) => {
  try {
    const idsParam = req.query.ids;
    const ids =
      typeof idsParam === "string"
        ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
        : [];

    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: "Provide at least one event id via ?ids=" });
    }

    const data = await analyticsService.compareEvents(ids);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("Error comparing event analytics:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};