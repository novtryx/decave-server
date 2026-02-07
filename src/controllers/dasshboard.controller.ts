import { Request, Response } from "express";
import transactionService from "../services/transaction.service";
import eventService from "../services/event.service";
import notificationService from "../services/notification.service";


export const dashboardData = async (req: Request, res: Response) => {
  try {
    const [
      transactionStat,
      ticketStat,
      upcoming,
      notification,
    ] = await Promise.all([
      transactionService.getDashboardStats(),
      eventService.getEventDashboardStats(),
      eventService.getUpcomingEvents(),
      notificationService.getAllActivities(),
    ]);

    return res.status(200).json({
      success: true,
      upcomingEvents: upcoming,
      ticketSale: transactionStat.ticketsSold,
      revenue: transactionStat.revenue,
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
