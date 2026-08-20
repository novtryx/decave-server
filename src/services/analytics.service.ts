import mongoose from "mongoose";
import TransactionHistory from "../models/transactionHistory.model";
import eventModel from "../models/event.model";
import PageVisit from "../models/pageVisit.model";
import {
  DashboardRange,
  DashboardDateRange,
  getDashboardDateRange,
  buildDateMatch,
} from "../utils/daterange";

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
  eventsConsidered: number; // events whose endDate has passed, within range
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

interface MetricWithChange {
  value: number;
  changePercent: number | null;
}

interface TrendPoint {
  label: string;
  revenue: number;
  tickets: number;
}

interface AnalyticsResult {
  range?: DashboardRange;
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
  revenue?: MetricWithChange;
  tickets?: MetricWithChange;
  conversion?: MetricWithChange;
  trend?: TrendPoint[];
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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
  private percentChange(current: number, previous: number | null): number | null {
    if (previous === null) return null;
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Picks how to bucket the revenue/tickets trend chart based on the
   * selected range — a flat "month vs year" toggle doesn't make sense
   * anymore now that range is flexible, so granularity scales with
   * window size: daily within a month, weekly within 3 months,
   * monthly within a year, yearly for all-time.
   */
  private getTrendGrouping(range: DashboardRange) {
    switch (range) {
      case "month":
        return {
          groupId: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          label: (id: any) => `${id.day}`,
          sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } as Record<string, 1>,
        };
      case "3months":
        return {
          groupId: {
            year: { $isoWeekYear: "$createdAt" },
            week: { $isoWeek: "$createdAt" },
          },
          label: (id: any) => `Wk ${id.week}`,
          sort: { "_id.year": 1, "_id.week": 1 } as Record<string, 1>,
        };
      case "year":
        return {
          groupId: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          label: (id: any) => MONTH_LABELS[id.month - 1] ?? `${id.month}`,
          sort: { "_id.year": 1, "_id.month": 1 } as Record<string, 1>,
        };
      case "all":
      default:
        return {
          groupId: { year: { $year: "$createdAt" } },
          label: (id: any) => `${id.year}`,
          sort: { "_id.year": 1 } as Record<string, 1>,
        };
    }
  }

  // ==================== TICKET SALES DETAILS ====================
  /**
   * Detailed ticket sales (revenue + count per ticket type), scoped
   * to a date window. Pass `window: null` for no lower bound (i.e.
   * all-time).
   */
  public async getTicketSalesDetails(
    window: DashboardDateRange["current"] | null = null
  ): Promise<TicketSalesDetail[]> {
    await this.ensureConnection();

    const dateMatch = window ? buildDateMatch("createdAt", window) : null;

    const salesData = await this.transactionModel.aggregate([
      { $match: { status: "completed", ...(dateMatch || {}) } },
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
        // bought for, by the ticket's real ObjectId.
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
  public async getEventTicketStats(
    dateRange: DashboardDateRange
  ): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const ticketSalesDetails = await this.getTicketSalesDetails(dateRange.current);

    const totalTickets = ticketSalesDetails.reduce((acc, item) => acc + item.ticketsSold, 0);
    const totalRevenue = ticketSalesDetails.reduce((acc, item) => acc + item.revenue, 0);

    const uniqueEvents = new Set(ticketSalesDetails.map((item) => item.eventId));
    const totalEvents = uniqueEvents.size;

    // Published events created within the selected window (for "all"
    // this is every published event ever, matching the old behavior).
    const publishedMatch: any = { published: true };
    const createdAtMatch = buildDateMatch("createdAt", dateRange.current);
    if (createdAtMatch) Object.assign(publishedMatch, createdAtMatch);
    const totalPublishedEvents = await this.eventModel.countDocuments(publishedMatch);

    // Roll ticket-tier-level sales up to event-level, ranked by
    // revenue (not just ticket count).
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

    const transactionDateMatch = buildDateMatch("createdAt", dateRange.current);
    const totalCompletedTransactions = await this.transactionModel.countDocuments({
      status: "completed",
      ...(transactionDateMatch || {}),
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

  // ==================== REVENUE / TICKETS (RANGE-AWARE, WITH TREND) ====================
  /**
   * Revenue + tickets sold for the selected range, compared against
   * the equivalent prior window — same comparison model as the
   * dashboard. "all" has no prior window, so changePercent is null
   * rather than a fabricated number.
   */
  public async getRevenueAndTicketsStats(
    dateRange: DashboardDateRange
  ): Promise<AnalyticsResult> {
    await this.ensureConnection();

    // Ticket count never actually needs the event/ticket join — it's
    // just buyers.length summed across completed transactions, same
    // as the dashboard's calculation. Keeping it join-free matters:
    // if an event is later deleted, its transaction records aren't
    // cascade-deleted (see eventService.deleteEvent), so a join-based
    // count would silently drop those tickets while the dashboard's
    // simple count wouldn't — producing two different "tickets sold"
    // numbers for what should be the same figure.
    const countTicketsForWindow = async (window: DashboardDateRange["current"] | null) => {
      if (!window) return 0;

      const dateMatch = buildDateMatch("createdAt", window);
      const [result] = await this.transactionModel.aggregate([
        { $match: { status: "completed", ...(dateMatch || {}) } },
        { $group: { _id: null, tickets: { $sum: { $size: "$buyers" } } } },
      ]);

      return result?.tickets || 0;
    };

    // Revenue genuinely needs the ticket's price, so it does require
    // the join — and will under-count for orphaned transactions
    // (deleted events/tickets) since there's no price to attribute
    // them to. That's an inherent limitation of revenue specifically,
    // not a bug to "fix" the same way the ticket count was.
    const sumRevenueForWindow = async (window: DashboardDateRange["current"] | null) => {
      if (!window) return 0;

      const dateMatch = buildDateMatch("createdAt", window);
      const [result] = await this.transactionModel.aggregate([
        { $match: { status: "completed", ...(dateMatch || {}) } },
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
        { $match: { $expr: { $eq: ["$ticket", "$eventData.tickets._id"] } } },
        {
          $group: {
            _id: null,
            revenue: {
              $sum: { $multiply: [{ $size: "$buyers" }, "$eventData.tickets.price"] },
            },
          },
        },
      ]);

      return result?.revenue || 0;
    };

    const [currentTickets, previousTickets, currentRevenue, previousRevenue] =
      await Promise.all([
        countTicketsForWindow(dateRange.current),
        dateRange.previous ? countTicketsForWindow(dateRange.previous) : Promise.resolve(null),
        sumRevenueForWindow(dateRange.current),
        dateRange.previous ? sumRevenueForWindow(dateRange.previous) : Promise.resolve(null),
      ]);

    return {
      revenue: {
        value: currentRevenue,
        changePercent:
          previousRevenue !== null ? this.percentChange(currentRevenue, previousRevenue) : null,
      },
      tickets: {
        value: currentTickets,
        changePercent:
          previousTickets !== null ? this.percentChange(currentTickets, previousTickets) : null,
      },
    };
  }

  // ==================== TREND BREAKDOWN (FOR CHARTS) ====================
  /**
   * Revenue/tickets over time within the selected range, bucketed at
   * a granularity that fits the window size (day/week/month/year).
   */
  public async getTrendBreakdown(
    range: DashboardRange,
    dateRange: DashboardDateRange
  ): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const { groupId, label, sort } = this.getTrendGrouping(range);
    const dateMatch = buildDateMatch("createdAt", dateRange.current);

    // Tickets-per-bucket: join-free, same reasoning as
    // getRevenueAndTicketsStats — must match the headline ticket
    // count, which doesn't depend on the event/ticket still existing.
    const ticketsByBucketPromise = this.transactionModel.aggregate([
      { $match: { status: "completed", ...(dateMatch || {}) } },
      {
        $project: {
          groupKey: groupId,
          ticketsSold: { $size: "$buyers" },
        },
      },
      { $group: { _id: "$groupKey", tickets: { $sum: "$ticketsSold" } } },
    ]);

    // Revenue-per-bucket: needs the join for price, so it can
    // under-count buckets containing only orphaned transactions —
    // same inherent limitation as the headline revenue figure.
    const revenueByBucketPromise = this.transactionModel.aggregate([
      { $match: { status: "completed", ...(dateMatch || {}) } },
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
      { $match: { $expr: { $eq: ["$ticket", "$eventData.tickets._id"] } } },
      {
        $project: {
          groupKey: groupId,
          revenue: {
            $multiply: [{ $size: "$buyers" }, "$eventData.tickets.price"],
          },
        },
      },
      { $group: { _id: "$groupKey", revenue: { $sum: "$revenue" } } },
    ]);

    const [ticketsByBucket, revenueByBucket] = await Promise.all([
      ticketsByBucketPromise,
      revenueByBucketPromise,
    ]);

    // Merge the two by their underlying date key (not just the
    // display label) to avoid any chance of label collisions.
    const merged = new Map<string, { id: any; revenue: number; tickets: number }>();

    ticketsByBucket.forEach((d: any) => {
      const key = JSON.stringify(d._id);
      merged.set(key, { id: d._id, revenue: 0, tickets: d.tickets });
    });
    revenueByBucket.forEach((d: any) => {
      const key = JSON.stringify(d._id);
      const existing = merged.get(key);
      if (existing) {
        existing.revenue = d.revenue;
      } else {
        merged.set(key, { id: d._id, revenue: d.revenue, tickets: 0 });
      }
    });

    const trend: TrendPoint[] = Array.from(merged.values())
      .sort((a, b) => {
        for (const sortKey of Object.keys(sort)) {
          const field = sortKey.replace("_id.", "");
          const diff = (a.id[field] ?? 0) - (b.id[field] ?? 0);
          if (diff !== 0) return diff;
        }
        return 0;
      })
      .map((d) => ({
        label: label(d.id),
        revenue: d.revenue,
        tickets: d.tickets,
      }));

    return { trend };
  }

  // ==================== CONVERSION RATE (SELL-THROUGH) ====================
  /**
   * Tickets sold in the selected range as a share of total ticket
   * inventory across published events. This is sell-through, not
   * funnel conversion (there's no page-view tracking in this stack
   * to measure visits -> purchases).
   */
  public async getConversionRates(dateRange: DashboardDateRange): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const [totalAvailableTickets] = await this.eventModel.aggregate([
      { $match: { published: true } },
      { $unwind: "$tickets" },
      { $group: { _id: null, totalTickets: { $sum: "$tickets.initialQuantity" } } },
    ]);
    const totalTicketsAvailable = totalAvailableTickets?.totalTickets || 0;

    const ticketsSoldInWindow = async (window: DashboardDateRange["current"] | null) => {
      if (!window) return 0;
      const dateMatch = buildDateMatch("createdAt", window);
      const [result] = await this.transactionModel.aggregate([
        { $match: { status: "completed", ...(dateMatch || {}) } },
        { $group: { _id: null, ticketsSold: { $sum: { $size: "$buyers" } } } },
      ]);
      return result?.ticketsSold || 0;
    };

    const [currentSold, previousSold] = await Promise.all([
      ticketsSoldInWindow(dateRange.current),
      dateRange.previous ? ticketsSoldInWindow(dateRange.previous) : Promise.resolve(null),
    ]);

    const currentConversion =
      totalTicketsAvailable === 0 ? 0 : (currentSold / totalTicketsAvailable) * 100;
    const previousConversion =
      previousSold === null
        ? null
        : totalTicketsAvailable === 0
        ? 0
        : (previousSold / totalTicketsAvailable) * 100;

    return {
      conversion: {
        value: Number(currentConversion.toFixed(2)),
        changePercent: this.percentChange(currentConversion, previousConversion),
      },
    };
  }

  // ==================== CHECK-IN RATE ====================
  /**
   * What fraction of sold tickets were actually used, for events that
   * have already ended within the selected window. An event still
   * upcoming always shows 0% checked in, which isn't meaningful yet,
   * so it's excluded rather than dragging the rate down.
   */
  public async getCheckInStats(dateRange: DashboardDateRange): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const now = new Date();
    const endDateMatch: any = { $lt: now };
    if (dateRange.current.start) endDateMatch.$gte = dateRange.current.start;

    const pastEventIds = await this.eventModel
      .find({ "eventDetails.endDate": endDateMatch })
      .distinct("_id");

    if (pastEventIds.length === 0) {
      return {
        checkInStats: { totalSold: 0, totalCheckedIn: 0, checkInRate: 0, eventsConsidered: 0 },
      };
    }

    const [result] = await this.transactionModel.aggregate([
      { $match: { status: "completed", event: { $in: pastEventIds } } },
      { $unwind: "$buyers" },
      {
        $group: {
          _id: null,
          totalSold: { $sum: 1 },
          totalCheckedIn: { $sum: { $cond: [{ $eq: ["$buyers.checkedIn", true] }, 1, 0] } },
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
  public async getPaymentHealthStats(dateRange: DashboardDateRange): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const dateMatch = buildDateMatch("createdAt", dateRange.current);

    const results = await this.transactionModel.aggregate([
      ...(dateMatch ? [{ $match: dateMatch }] : []),
      { $group: { _id: "$status", count: { $sum: 1 } } },
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
  public async getInfluencerStats(dateRange: DashboardDateRange): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const dateMatch = buildDateMatch("createdAt", dateRange.current);

    const results = await this.transactionModel.aggregate([
      { $match: { status: "completed", ...(dateMatch || {}) } },
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
   * A live snapshot of ticket sale windows right now — deliberately
   * NOT scoped to the selected range, since "on sale" is a current
   * state, not a historical one.
   */
  public async getTicketSaleWindowStats(): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const now = new Date();
    const events = await this.eventModel.find({ published: true }).select("tickets").lean();

    const stats: TicketSaleWindowStats = {
      onSale: 0,
      notYetOpen: 0,
      closed: 0,
      noWindowSet: 0,
    };

    for (const event of events) {
      for (const ticket of event.tickets || []) {
        const start = (ticket as any).saleStartDate ? new Date((ticket as any).saleStartDate) : null;
        const end = (ticket as any).saleEndDate ? new Date((ticket as any).saleEndDate) : null;

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

  // ==================== EVENT-LEVEL ANALYTICS ====================
  /**
   * Dedicated analytics for a single event: ticket tier breakdown
   * (revenue, velocity, sale-window status, unsold-inventory flag),
   * daily sales trend, peak sale day, and no-show rate. This is the
   * drill-down the all-time/range analytics above can't give you.
   */
  public async getEventAnalytics(eventId: string): Promise<any> {
    await this.ensureConnection();

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const err: any = new Error("Invalid event id");
      err.statusCode = 400;
      throw err;
    }

    const eventObjectId = new mongoose.Types.ObjectId(eventId);
    const event = await this.eventModel.findById(eventObjectId).lean<any>();

    if (!event) {
      const err: any = new Error("Event not found");
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    // Manually-verified bank transfers count as real sales, same as
    // completed Paystack transactions — both move real money.
    const REVENUE_STATUSES = ["completed", "manually_verified"];

    // Per-ticket, per-status buyer counts for this event in one pass.
    const perTicket = await this.transactionModel.aggregate([
      { $match: { event: eventObjectId } },
      {
        $group: {
          _id: { ticket: "$ticket", status: "$status" },
          buyersCount: { $sum: { $size: "$buyers" } },
          checkedInCount: {
            $sum: {
              $size: {
                $filter: { input: "$buyers", as: "b", cond: { $eq: ["$$b.checkedIn", true] } },
              },
            },
          },
        },
      },
    ]);

    const ticketAgg = new Map<
      string,
      { sold: number; checkedIn: number; pending: number; refunded: number; cancelled: number }
    >();
    for (const row of perTicket) {
      const ticketId = row._id.ticket?.toString();
      if (!ticketId) continue;
      const bucket =
        ticketAgg.get(ticketId) || { sold: 0, checkedIn: 0, pending: 0, refunded: 0, cancelled: 0 };

      if (REVENUE_STATUSES.includes(row._id.status)) {
        bucket.sold += row.buyersCount;
        bucket.checkedIn += row.checkedInCount;
      } else if (row._id.status === "pending") {
        bucket.pending += row.buyersCount;
      } else if (row._id.status === "refunded") {
        bucket.refunded += row.buyersCount;
      } else if (row._id.status === "cancelled") {
        bucket.cancelled += row.buyersCount;
      }
      ticketAgg.set(ticketId, bucket);
    }

    const tierBreakdown = (event.tickets || []).map((ticket: any) => {
      const agg =
        ticketAgg.get(ticket._id.toString()) ||
        { sold: 0, checkedIn: 0, pending: 0, refunded: 0, cancelled: 0 };
      const revenue = agg.sold * ticket.price;
      const soldPercent = ticket.initialQuantity > 0 ? (agg.sold / ticket.initialQuantity) * 100 : 0;

      const start = ticket.saleStartDate ? new Date(ticket.saleStartDate) : null;
      const end = ticket.saleEndDate ? new Date(ticket.saleEndDate) : null;
      let saleWindowStatus: "on_sale" | "not_yet_open" | "closed" | "no_window_set";
      if (!start && !end) saleWindowStatus = "no_window_set";
      else if (start && now < start) saleWindowStatus = "not_yet_open";
      else if (end && now > end) saleWindowStatus = "closed";
      else saleWindowStatus = "on_sale";

      // Sell-through velocity: tickets sold per day since the sale
      // window opened (or since the event was created, if no window
      // was ever set).
      const windowOpenedAt = start || event.createdAt || now;
      const daysActive = Math.max(1, (now.getTime() - new Date(windowOpenedAt).getTime()) / 86400000);
      const salesVelocityPerDay = Number((agg.sold / daysActive).toFixed(2));

      return {
        ticketId: ticket._id.toString(),
        ticketName: ticket.ticketName,
        tierCategory: ticket.tierCategory || "standard",
        price: ticket.price,
        currency: ticket.currency,
        initialQuantity: ticket.initialQuantity,
        availableQuantity: ticket.availableQuantity,
        ticketsSold: agg.sold,
        revenue,
        soldPercent: Number(soldPercent.toFixed(1)),
        checkedIn: agg.checkedIn,
        pending: agg.pending,
        refunded: agg.refunded,
        cancelled: agg.cancelled,
        saleWindowStatus,
        salesVelocityPerDay,
      };
    });

    // Flag unsold inventory and recommend opening the next phase.
    // Heuristic: a tier counts as unsold inventory once its window has
    // closed (or the event has already started) while under 70% of it
    // has sold. "Next phase" is the following tier in array order if
    // it hasn't opened yet and this tier is fully sold out.
    const eventHasStarted = event.eventDetails?.startDate
      ? now >= new Date(event.eventDetails.startDate)
      : false;

    tierBreakdown.forEach((tier: any, index: number) => {
      tier.unsoldInventoryFlag =
        (tier.saleWindowStatus === "closed" || eventHasStarted) &&
        tier.soldPercent < 70 &&
        tier.availableQuantity > 0;

      if (tier.availableQuantity === 0) {
        const next = tierBreakdown[index + 1];
        tier.recommendNextPhase =
          next && next.saleWindowStatus === "not_yet_open" ? next.ticketName : null;
      } else {
        tier.recommendNextPhase = null;
      }
    });

    // Daily sales trend, revenue-status transactions only.
    const dailyTrend = await this.transactionModel.aggregate([
      { $match: { event: eventObjectId, status: { $in: REVENUE_STATUSES } } },
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
              $filter: { input: "$eventData.tickets", as: "t", cond: { $eq: ["$$t._id", "$ticket"] } },
            },
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          ticketsSold: { $sum: { $size: "$buyers" } },
          revenue: { $sum: { $multiply: [{ $size: "$buyers" }, "$ticketInfo.price"] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dailySalesTrend = dailyTrend.map((d: any) => ({
      date: d._id,
      ticketsSold: d.ticketsSold,
      revenue: d.revenue,
    }));

    const peakSaleDay = dailySalesTrend.reduce(
      (peak: any, point: any) => (!peak || point.revenue > peak.revenue ? point : peak),
      null
    );

    const totalTicketsSold = tierBreakdown.reduce((sum: number, t: any) => sum + t.ticketsSold, 0);
    const totalRevenue = tierBreakdown.reduce((sum: number, t: any) => sum + t.revenue, 0);
    const totalCheckedIn = tierBreakdown.reduce((sum: number, t: any) => sum + t.checkedIn, 0);
    const noShowCount = Math.max(0, totalTicketsSold - totalCheckedIn);
    const noShowRate =
      totalTicketsSold > 0 ? Number(((noShowCount / totalTicketsSold) * 100).toFixed(1)) : 0;
    const checkInRate =
      totalTicketsSold > 0 ? Number(((totalCheckedIn / totalTicketsSold) * 100).toFixed(1)) : 0;

    return {
      eventId,
      eventTitle: event.eventDetails?.eventTitle,
      eventBanner: event.eventDetails?.eventBanner,
      published: event.published,
      startDate: event.eventDetails?.startDate,
      endDate: event.eventDetails?.endDate,
      totalTicketsCreated: (event.tickets || []).reduce((s: number, t: any) => s + t.initialQuantity, 0),
      totalTicketsSold,
      totalTicketsRemaining: (event.tickets || []).reduce((s: number, t: any) => s + t.availableQuantity, 0),
      totalRevenue,
      tierBreakdown,
      dailySalesTrend,
      peakSaleDay,
      noShowRate,
      checkInRate,
      totalCheckedIn,
    };
  }

  // ==================== TRAFFIC SOURCE BREAKDOWN ====================
  /**
   * How visitors reached this event's page — Instagram, WhatsApp,
   * etc — plus how many of each source went on to actually buy a
   * ticket. Conversion is matched by `sessionRef`: the frontend
   * generates one id per visit and sends it both to the visit-tracking
   * call and, if they check out, along with the purchase, so a visit
   * and a resulting transaction can be joined without cookies or
   * user accounts.
   */
  public async getEventTrafficSources(eventId: string): Promise<any> {
    await this.ensureConnection();

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const err: any = new Error("Invalid event id");
      err.statusCode = 400;
      throw err;
    }
    const eventObjectId = new mongoose.Types.ObjectId(eventId);

    const [visitsBySource, purchasesBySource, totalVisits] = await Promise.all([
      PageVisit.aggregate([
        { $match: { event: eventObjectId } },
        { $group: { _id: "$source", visits: { $sum: 1 } } },
      ]),
      // Join completed/pending-turned-completed transactions back to
      // the visit that led to them via sessionRef, so we can show a
      // conversion rate per source, not just raw visit counts.
      TransactionHistory.aggregate([
        { $match: { event: eventObjectId, status: { $in: ["completed", "manually_verified"] }, sessionRef: { $exists: true, $ne: null } } },
        {
          $lookup: {
            from: "pagevisits",
            let: { ref: "$sessionRef" },
            pipeline: [{ $match: { $expr: { $eq: ["$sessionRef", "$$ref"] } } }],
            as: "visit",
          },
        },
        { $unwind: { path: "$visit", preserveNullAndEmptyArrays: false } },
        { $group: { _id: "$visit.source", purchases: { $sum: 1 } } },
      ]),
      PageVisit.countDocuments({ event: eventObjectId }),
    ]);

    const purchaseMap = new Map<string, number>(
      purchasesBySource.map((row: any) => [row._id, row.purchases])
    );

    const breakdown = visitsBySource
      .map((row: any) => {
        const visits = row.visits;
        const purchases = purchaseMap.get(row._id) || 0;
        return {
          source: row._id,
          visits,
          purchases,
          conversionRate: visits > 0 ? Number(((purchases / visits) * 100).toFixed(1)) : 0,
          sharePercent: totalVisits > 0 ? Number(((visits / totalVisits) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a: any, b: any) => b.visits - a.visits);

    return {
      eventId,
      totalVisits,
      sources: breakdown,
    };
  }

  /**
   * Side-by-side comparison for multiple events — e.g. Loud Room one
   * vs Loud Room two vs AfroSpook. Silently skips ids that are
   * invalid or no longer exist rather than failing the whole batch.
   */
  public async compareEvents(eventIds: string[]): Promise<any[]> {
    const results: any[] = [];
    for (const id of eventIds) {
      try {
        results.push(await this.getEventAnalytics(id));
      } catch (err) {
        continue;
      }
    }
    return results;
  }

  // ==================== COMBINED ANALYTICS ====================
  /**
   * Get all analytics data in a single call, scoped to the given
   * range — same range system as the dashboard (month / 3months /
   * year / all), defaulting to "all".
   */
  public async getAllAnalytics(range: DashboardRange = "all"): Promise<AnalyticsResult> {
    await this.ensureConnection();

    const dateRange = getDashboardDateRange(range);

    const [
      eventStats,
      revenueTicketsData,
      trendData,
      conversionData,
      checkInData,
      paymentHealthData,
      influencerData,
      ticketSaleWindowData,
    ] = await Promise.all([
      this.getEventTicketStats(dateRange),
      this.getRevenueAndTicketsStats(dateRange),
      this.getTrendBreakdown(range, dateRange),
      this.getConversionRates(dateRange),
      this.getCheckInStats(dateRange),
      this.getPaymentHealthStats(dateRange),
      this.getInfluencerStats(dateRange),
      this.getTicketSaleWindowStats(),
    ]);

    return {
      range,
      ...eventStats,
      ...revenueTicketsData,
      ...trendData,
      ...conversionData,
      ...checkInData,
      ...paymentHealthData,
      ...influencerData,
      ...ticketSaleWindowData,
    };
  }
}