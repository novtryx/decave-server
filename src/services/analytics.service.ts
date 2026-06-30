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
  currency: string;
}

interface TopEventByRevenue {
  eventId: string;
  eventTitle: string;
  revenue: number;
  ticketsSold: number;
}

interface CheckInStats {
  totalSold: number;
  totalCheckedIn: number;
  checkInRate: number; // percentage, 0-100
  eventsConsidered: number; // events whose endDate has passed
}

interface PaymentHealthStats {
  totalCompleted: number;
  totalPending: number;
  totalFailed: number;
  completionRate: number; // percentage of completed among all transactions
}

interface InfluencerStats {
  influencerRevenue: number;
  influencerTickets: number;
  organicRevenue: number;
  organicTickets: number;
  influencerRevenueSharePercent: number; // % of total revenue attributed to influencers
}

interface TicketSaleWindowStats {
  onSale: number; // currently purchasable
  notYetOpen: number; // saleStartDate is in the future
  closed: number; // saleEndDate has passed
  noWindowSet: number; // no sale window configured (always open)
}

interface AnalyticsResult {
  totalRevenue?: number;
  totalTickets?: number;
  totalEvents?: number;
  totalPublishedEvents?: number;
  totalCompletedTransactions?: number;
  avgOrderValue?: number;
  avgTicketsPerOrder?: number;
  ticketSalesDetails?: TicketSalesDetail[];
  topEventsByRevenue?: TopEventByRevenue[];
  checkInStats?: CheckInStats;
  paymentHealth?: PaymentHealthStats;
  influencerStats?: InfluencerStats;
  ticketSaleWindowStats?: TicketSaleWindowStats;
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
        // Match each transaction to the *specific* ticket type it was
        // bought for, by the ticket's real ObjectId. The previous
        // version compared "$ticketInfo.title" (a field that doesn't
        // exist on the transaction document) against
        // "$eventData.tickets.title" (the real field is
        // "ticketName") — both sides were always undefined, so every
        // transaction silently matched every ticket type in its
        // event, inflating sold counts and revenue for any event with
        // more than one ticket type.
        $match: {
          $expr: {
            $eq: ["$ticket", "$eventData.tickets._id"],
          },
        },
      },
      {
        $project: {
          eventId: "$event",
          eventTitle: "$eventData.eventDetails.eventTitle",
          ticketTitle: "$eventData.tickets.ticketName",
          ticketPrice: "$eventData.tickets.price",
          currency: "$eventData.tickets.currency",
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
            currency: "$currency",
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
          currency: "$_id.currency",
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

    // Roll ticket-tier-level sales up to event-level, ranked by
    // revenue (not just ticket count) — a premium event with fewer,
    // pricier tickets can easily outearn a high-volume cheap one, so
    // ranking by tickets sold alone is misleading.
    const eventTotals = new Map<string, TopEventByRevenue>();
    for (const item of ticketSalesDetails) {
      const existing = eventTotals.get(item.eventId);
      if (existing) {
        existing.revenue += item.revenue;
        existing.ticketsSold += item.ticketsSold;
      } else {
        eventTotals.set(item.eventId, {
          eventId: item.eventId,
          eventTitle: item.eventTitle,
          revenue: item.revenue,
          ticketsSold: item.ticketsSold,
        });
      }
    }
    const topEventsByRevenue = Array.from(eventTotals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Average order value / tickets per order — needs the count of
    // completed transactions (not ticket-tier rows, which can be
    // multiple per transaction).
    const totalCompletedTransactions = await this.transactionModel.countDocuments({
      status: "completed",
    });
    const avgOrderValue =
      totalCompletedTransactions > 0 ? totalRevenue / totalCompletedTransactions : 0;
    const avgTicketsPerOrder =
      totalCompletedTransactions > 0 ? totalTickets / totalCompletedTransactions : 0;

    return {
      totalEvents,
      totalTickets,
      totalRevenue,
      totalPublishedEvents,
      totalCompletedTransactions,
      avgOrderValue: Number(avgOrderValue.toFixed(2)),
      avgTicketsPerOrder: Number(avgTicketsPerOrder.toFixed(2)),
      ticketSalesDetails,
      topEventsByRevenue,
    };
  }

  // ==================== MONTHLY METRICS ====================
  public async getMonthlyRevenueAndTickets(): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // The query window must cover "last month" even when last month
    // fell in the previous calendar year (i.e. it's currently
    // January) — otherwise December's data is invisible, gets read
    // as 0, and produces a fake "+100%" spike every January.
    const matchStart = lastMonth < startOfYear ? lastMonth : startOfYear;

    const data = await this.transactionModel.aggregate([
      { $match: { status: "completed", createdAt: { $gte: matchStart } } },
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
    // Always include at least last year in the query window, even if
    // `years` is passed in small enough that it would otherwise be
    // excluded — last year's figure is needed for the YoY comparison.
    const startYear = Math.min(now.getFullYear() - years + 1, now.getFullYear() - 1);

    const data = await this.transactionModel.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: new Date(Date.UTC(startYear, 0, 1)) },
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
        { $match: { published: true } },
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

  // ==================== CHECK-IN RATE ====================
  /**
   * What fraction of sold tickets were actually used. Only counts
   * events that have already ended — an event still upcoming will
   * always show 0% checked in, which isn't a meaningful "no-show"
   * signal yet.
   */
  public async getCheckInStats(): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const now = new Date();

    const pastEventIds = await this.eventModel
      .find({ "eventDetails.endDate": { $lt: now } })
      .distinct("_id");

    if (pastEventIds.length === 0) {
      return {
        checkInStats: {
          totalSold: 0,
          totalCheckedIn: 0,
          checkInRate: 0,
          eventsConsidered: 0,
        },
      };
    }

    const [result] = await this.transactionModel.aggregate([
      {
        $match: {
          status: "completed",
          event: { $in: pastEventIds },
        },
      },
      { $unwind: "$buyers" },
      {
        $group: {
          _id: null,
          totalSold: { $sum: 1 },
          totalCheckedIn: {
            $sum: { $cond: [{ $eq: ["$buyers.checkedIn", true] }, 1, 0] },
          },
        },
      },
    ]);

    const totalSold = result?.totalSold || 0;
    const totalCheckedIn = result?.totalCheckedIn || 0;
    const checkInRate = totalSold > 0 ? (totalCheckedIn / totalSold) * 100 : 0;

    return {
      checkInStats: {
        totalSold,
        totalCheckedIn,
        checkInRate: Number(checkInRate.toFixed(2)),
        eventsConsidered: pastEventIds.length,
      },
    };
  }

  // ==================== PAYMENT HEALTH ====================
  /**
   * Completed vs pending vs failed, across all transactions ever
   * created — an early-warning signal for checkout/payment-provider
   * issues independent of any single event's performance.
   */
  public async getPaymentHealthStats(): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const results = await this.transactionModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts: Record<string, number> = { completed: 0, pending: 0, failed: 0 };
    results.forEach((r: any) => {
      if (r._id in counts) counts[r._id] = r.count;
    });

    const total = counts.completed + counts.pending + counts.failed;
    const completionRate = total > 0 ? (counts.completed / total) * 100 : 0;

    return {
      paymentHealth: {
        totalCompleted: counts.completed,
        totalPending: counts.pending,
        totalFailed: counts.failed,
        completionRate: Number(completionRate.toFixed(2)),
      },
    };
  }

  // ==================== INFLUENCER ATTRIBUTION ====================
  /**
   * How much of total revenue/tickets came through an influencer
   * referral code vs. organic (direct) purchases.
   */
  public async getInfluencerStats(): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const results = await this.transactionModel.aggregate([
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
      {
        $addFields: {
          ticketInfo: {
            $first: {
              $filter: {
                input: "$eventData.tickets",
                as: "t",
                cond: { $eq: ["$$t._id", "$ticket"] },
              },
            },
          },
          quantity: { $size: "$buyers" },
        },
      },
      {
        $group: {
          _id: { $cond: [{ $ne: ["$influencer", null] }, "influencer", "organic"] },
          revenue: { $sum: { $multiply: ["$quantity", "$ticketInfo.price"] } },
          tickets: { $sum: "$quantity" },
        },
      },
    ]);

    let influencerRevenue = 0;
    let influencerTickets = 0;
    let organicRevenue = 0;
    let organicTickets = 0;

    results.forEach((r: any) => {
      if (r._id === "influencer") {
        influencerRevenue = r.revenue;
        influencerTickets = r.tickets;
      } else {
        organicRevenue = r.revenue;
        organicTickets = r.tickets;
      }
    });

    const totalRevenue = influencerRevenue + organicRevenue;
    const influencerRevenueSharePercent =
      totalRevenue > 0 ? (influencerRevenue / totalRevenue) * 100 : 0;

    return {
      influencerStats: {
        influencerRevenue,
        influencerTickets,
        organicRevenue,
        organicTickets,
        influencerRevenueSharePercent: Number(influencerRevenueSharePercent.toFixed(2)),
      },
    };
  }

  // ==================== TICKET SALE WINDOW STATUS ====================
  /**
   * How many ticket tiers (across all published events) are
   * currently on sale, not yet open, or already closed — only
   * meaningful now that tickets can have a sale window at all.
   */
  public async getTicketSaleWindowStats(): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const now = new Date();

    const events = await this.eventModel
      .find({ published: true })
      .select("tickets")
      .lean();

    const stats: TicketSaleWindowStats = {
      onSale: 0,
      notYetOpen: 0,
      closed: 0,
      noWindowSet: 0,
    };

    for (const event of events) {
      for (const ticket of event.tickets || []) {
        const start = (ticket as any).saleStartDate
          ? new Date((ticket as any).saleStartDate)
          : null;
        const end = (ticket as any).saleEndDate
          ? new Date((ticket as any).saleEndDate)
          : null;

        if (!start && !end) {
          stats.noWindowSet++;
        } else if (start && now < start) {
          stats.notYetOpen++;
        } else if (end && now > end) {
          stats.closed++;
        } else {
          stats.onSale++;
        }
      }
    }

    return { ticketSaleWindowStats: stats };
  }

  // ==================== COMBINED ANALYTICS ====================
  /**
   * Get all analytics data in a single call
   */
  public async getAllAnalytics(years: number = 7): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const [
      eventStats,
      monthlyData,
      yearlyData,
      conversionData,
      checkInData,
      paymentHealthData,
      influencerData,
      ticketSaleWindowData,
    ] = await Promise.all([
      this.getEventTicketStats(),
      this.getMonthlyRevenueAndTickets(),
      this.getYearlyRevenueAndTickets(years),
      this.getConversionRates(),
      this.getCheckInStats(),
      this.getPaymentHealthStats(),
      this.getInfluencerStats(),
      this.getTicketSaleWindowStats(),
    ]);

    return {
      ...eventStats,
      ...monthlyData,
      ...yearlyData,
      ...conversionData,
      ...checkInData,
      ...paymentHealthData,
      ...influencerData,
      ...ticketSaleWindowData,
    };
  }
}