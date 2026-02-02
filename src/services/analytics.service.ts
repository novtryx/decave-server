import mongoose from "mongoose";
import TransactionHistory from "../models/transactionHistory.model";
import eventModel from "../models/event.model";
interface TicketSalesDetail {
  eventId: string;
  eventTitle: string;
  ticketTitle: string;
  ticketsSold: number;
  revenue: number;
  ticketPrice: number;
}

interface AnalyticsResult {
  totalRevenue?: number;
  totalTickets?: number;
  totalEvents?: number;
  totalPublishedEvents?: number;
  ticketSalesDetails?: TicketSalesDetail[];
  monthRevenue?: Record<string, number>;
  monthTickets?: Record<string, number>;
  yearRevenue?: Record<number, number>;
  yearTickets?: Record<number, number>;
  revenueThisMonth?: { value: number; changePercent: number };
  revenueThisYear?: { value: number; changePercent: number };
  ticketsThisMonth?: { value: number; changePercent: number };
  ticketsThisYear?: { value: number; changePercent: number };
  conversionThisMonth?: { value: number; changePercent: number };
  conversionThisYear?: { value: number; changePercent: number };
}

export class AnalyticsService {
  private transactionModel = TransactionHistory;
  private eventModel = eventModel;

  constructor() {}

  private async ensureConnection() {
    if (mongoose.connection.readyState === 0) {
      throw new Error("Database not connected");
    }
  }

  // ==================== HELPER FUNCTIONS ====================
  private percentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  // ==================== TICKET SALES DETAILS ====================
  /**
   * Get detailed ticket sales information including ticket title and revenue per ticket type
   */
  public async getTicketSalesDetails(): Promise<TicketSalesDetail[]> {
    await this.ensureConnection();

    const salesData = await this.transactionModel.aggregate([
      { $match: { status: "completed" } },
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventData",
        },
      },
      { $unwind: "$eventData" },
      { $unwind: "$eventData.tickets" },
      {
        $match: {
          $expr: {
            $eq: ["$ticketInfo.title", "$eventData.tickets.title"],
          },
        },
      },
      {
        $project: {
          eventId: "$event",
          eventTitle: "$eventData.eventDetails.eventTitle",
          ticketTitle: "$eventData.tickets.title",
          ticketPrice: "$eventData.tickets.price",
          ticketsSold: { $size: "$buyers" },
          revenue: {
            $multiply: [{ $size: "$buyers" }, "$eventData.tickets.price"],
          },
        },
      },
      {
        $group: {
          _id: {
            eventId: "$eventId",
            eventTitle: "$eventTitle",
            ticketTitle: "$ticketTitle",
            ticketPrice: "$ticketPrice",
          },
          ticketsSold: { $sum: "$ticketsSold" },
          revenue: { $sum: "$revenue" },
        },
      },
      {
        $project: {
          _id: 0,
          eventId: { $toString: "$_id.eventId" },
          eventTitle: "$_id.eventTitle",
          ticketTitle: "$_id.ticketTitle",
          ticketPrice: "$_id.ticketPrice",
          ticketsSold: 1,
          revenue: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    return salesData;
  }

  // ==================== CORE ANALYTICS METHODS ====================
  public async getEventTicketStats(): Promise<AnalyticsResult> {
    await this.ensureConnection();

    // Get ticket sales details with proper revenue calculation
    const ticketSalesDetails = await this.getTicketSalesDetails();

    // Aggregate totals from detailed sales
    const totalTickets = ticketSalesDetails.reduce(
      (acc, item) => acc + item.ticketsSold,
      0
    );
    const totalRevenue = ticketSalesDetails.reduce(
      (acc, item) => acc + item.revenue,
      0
    );

    // Count unique events
    const uniqueEvents = new Set(ticketSalesDetails.map((item) => item.eventId));
    const totalEvents = uniqueEvents.size;

    // Total published events
    const totalPublishedEvents = await this.eventModel.countDocuments({
      published: true,
    });

    return {
      totalEvents,
      totalTickets,
      totalRevenue,
      totalPublishedEvents,
      ticketSalesDetails,
    };
  }

  // ==================== MONTHLY METRICS ====================
  public async getMonthlyRevenueAndTickets(): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const data = await this.transactionModel.aggregate([
      { $match: { status: "completed", createdAt: { $gte: startOfYear } } },
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventData",
        },
      },
      { $unwind: "$eventData" },
      { $unwind: "$eventData.tickets" },
      {
        $match: {
          $expr: {
            $eq: ["$ticketInfo.title", "$eventData.tickets.title"],
          },
        },
      },
      {
        $project: {
          month: { $month: "$createdAt" },
          year: { $year: "$createdAt" },
          ticketsSold: { $size: "$buyers" },
          revenue: {
            $multiply: [{ $size: "$buyers" }, "$eventData.tickets.price"],
          },
        },
      },
      {
        $group: {
          _id: { month: "$month", year: "$year" },
          revenue: { $sum: "$revenue" },
          tickets: { $sum: "$ticketsSold" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthRevenue: Record<string, number> = {};
    const monthTickets: Record<string, number> = {};

    data.forEach((d: any) => {
      const key = `${d._id.year}-${d._id.month}`;
      monthRevenue[key] = d.revenue;
      monthTickets[key] = d.tickets;
    });

    // Calculate current month and last month changes
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${lastMonth.getMonth() + 1}`;

    const revenueThisMonth = monthRevenue[thisMonthKey] || 0;
    const revenueLastMonth = monthRevenue[lastMonthKey] || 0;

    const ticketsThisMonth = monthTickets[thisMonthKey] || 0;
    const ticketsLastMonth = monthTickets[lastMonthKey] || 0;

    return {
      monthRevenue,
      monthTickets,
      revenueThisMonth: {
        value: revenueThisMonth,
        changePercent: this.percentChange(revenueThisMonth, revenueLastMonth),
      },
      ticketsThisMonth: {
        value: ticketsThisMonth,
        changePercent: this.percentChange(ticketsThisMonth, ticketsLastMonth),
      },
    };
  }

  // ==================== YEARLY METRICS ====================
  public async getYearlyRevenueAndTickets(
    years: number = 7
  ): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const now = new Date();
    const startYear = now.getFullYear() - years + 1;

    const data = await this.transactionModel.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: new Date(`${startYear}-01-01`) },
        },
      },
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventData",
        },
      },
      { $unwind: "$eventData" },
      { $unwind: "$eventData.tickets" },
      {
        $match: {
          $expr: {
            $eq: ["$ticket", "$eventData.tickets._id"],
          },
        },
      },
      {
        $project: {
          year: { $year: "$createdAt" },
          ticketsSold: { $size: "$buyers" },
          revenue: {
            $multiply: [{ $size: "$buyers" }, "$eventData.tickets.price"],
          },
        },
      },
      {
        $group: {
          _id: { year: "$year" },
          revenue: { $sum: "$revenue" },
          tickets: { $sum: "$ticketsSold" },
        },
      },
      { $sort: { "_id.year": 1 } },
    ]);

    const yearRevenue: Record<number, number> = {};
    const yearTickets: Record<number, number> = {};

    data.forEach((d: any) => {
      yearRevenue[d._id.year] = d.revenue;
      yearTickets[d._id.year] = d.tickets;
    });

    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    const revenueThisYear = yearRevenue[thisYear] || 0;
    const revenueLastYear = yearRevenue[lastYear] || 0;

    const ticketsThisYear = yearTickets[thisYear] || 0;
    const ticketsLastYear = yearTickets[lastYear] || 0;

    return {
      yearRevenue,
      yearTickets,
      revenueThisYear: {
        value: revenueThisYear,
        changePercent: this.percentChange(revenueThisYear, revenueLastYear),
      },
      ticketsThisYear: {
        value: ticketsThisYear,
        changePercent: this.percentChange(ticketsThisYear, ticketsLastYear),
      },
    };
  }

  // ==================== CONVERSION RATE ====================
  public async getConversionRates(): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Monthly conversion
    const [monthlyTickets, totalAvailableTickets] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: { status: "completed", createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            ticketsSold: { $sum: { $size: "$buyers" } },
          },
        },
      ]),
      this.eventModel.aggregate([
        {
          $unwind: "$tickets",
        },
        {
          $group: {
            _id: null,
            totalTickets: { $sum: "$tickets.initialQuantity" },
          },
        },
      ]),
    ]);

    const ticketsSoldThisMonth = monthlyTickets[0]?.ticketsSold || 0;
    const totalTicketsAvailable = totalAvailableTickets[0]?.totalTickets || 1;

    const conversionThisMonth =
      totalTicketsAvailable === 0
        ? 0
        : (ticketsSoldThisMonth / totalTicketsAvailable) * 100;

    // Last month conversion for comparison
    const [lastMonthTickets] = await Promise.all([
      this.transactionModel.aggregate([
        {
          $match: {
            status: "completed",
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        {
          $group: {
            _id: null,
            ticketsSold: { $sum: { $size: "$buyers" } },
          },
        },
      ]),
    ]);

    const ticketsSoldLastMonth = lastMonthTickets[0]?.ticketsSold || 0;
    const conversionLastMonth =
      totalTicketsAvailable === 0
        ? 0
        : (ticketsSoldLastMonth / totalTicketsAvailable) * 100;

    // Yearly conversion
    const [yearlyTickets] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: { status: "completed", createdAt: { $gte: startOfYear } } },
        {
          $group: {
            _id: null,
            ticketsSold: { $sum: { $size: "$buyers" } },
          },
        },
      ]),
    ]);

    const ticketsSoldThisYear = yearlyTickets[0]?.ticketsSold || 0;

    const conversionThisYear =
      totalTicketsAvailable === 0
        ? 0
        : (ticketsSoldThisYear / totalTicketsAvailable) * 100;

    // Last year conversion for comparison
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
    const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

    const [lastYearTickets] = await Promise.all([
      this.transactionModel.aggregate([
        {
          $match: {
            status: "completed",
            createdAt: { $gte: startOfLastYear, $lte: endOfLastYear },
          },
        },
        {
          $group: {
            _id: null,
            ticketsSold: { $sum: { $size: "$buyers" } },
          },
        },
      ]),
    ]);

    const ticketsSoldLastYear = lastYearTickets[0]?.ticketsSold || 0;
    const conversionLastYear =
      totalTicketsAvailable === 0
        ? 0
        : (ticketsSoldLastYear / totalTicketsAvailable) * 100;

    return {
      conversionThisMonth: {
        value: conversionThisMonth,
        changePercent: this.percentChange(conversionThisMonth, conversionLastMonth),
      },
      conversionThisYear: {
        value: conversionThisYear,
        changePercent: this.percentChange(conversionThisYear, conversionLastYear),
      },
    };
  }

  // ==================== COMBINED ANALYTICS ====================
  /**
   * Get all analytics data in a single call
   */
  public async getAllAnalytics(years: number = 7): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const [eventStats, monthlyData, yearlyData, conversionData] =
      await Promise.all([
        this.getEventTicketStats(),
        this.getMonthlyRevenueAndTickets(),
        this.getYearlyRevenueAndTickets(years),
        this.getConversionRates(),
      ]);

    return {
      ...eventStats,
      ...monthlyData,
      ...yearlyData,
      ...conversionData,
    };
  }
}