import { Request, Response } from "express";
import transactionService from "../services/transaction.service";
import eventService from "../services/event.service";
import notificationService from "../services/notification.service";
import { parseDashboardRange } from "../utils/daterange";


export const dashboardData = async (req: Request, res: Response) => {
  try {
    const range = parseDashboardRange(req.query.range);

    const [
      transactionStat,
      ticketStat,
      upcoming,
      notification,
    ] = await Promise.all([
      transactionService.getDashboardStats(range),
      eventService.getEventDashboardStats(range),
      eventService.getUpcomingEvents(),
      notificationService.getAllActivities(),
    ]);

    return res.status(200).json({
      success: true,
      range,
      upcomingEvents: upcoming,
      ticketSale: transactionStat.ticketsSold,
      revnue: transactionStat.revenue,
      activeEvents: ticketStat.activeEvents,
      recentActivities: notification,
      avgTicketPrice: ticketStat.averageTicketPrice,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard data",
    });
  }
};