import mongoose from "mongoose";
import transactionHistoryModel from "../models/transactionHistory.model";
import eventModel from "../models/event.model";
import { getRedisClient } from "../config/redis";
import {
  DashboardRange,
  DashboardDateRange,
  DASHBOARD_RANGES,
  getDashboardDateRange,
  buildDateMatch
} from "../utils/daterange";

const DASHBOARD_CACHE_KEY = "dashboard:stats";
const DASHBOARD_CACHE_TTL = 60; // seconds

export class TransactionService {
  /**
   * ===============================
   * TRANSACTIONS LIST + TOTALS
   * ===============================
   */
 async getAllTransactions(page: number = 1, limit: number = 10) {
  try {

    const skip = (page - 1) * limit;

    const [result] = await transactionHistoryModel.aggregate([
      // 🔹 Join event data
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "event"
        }
      },
      { $unwind: "$event" },

      // 🔹 Resolve ticket and count buyers
      {
        $addFields: {
          ticketInfo: {
            $first: {
              $filter: {
                input: "$event.tickets",
                as: "t",
                cond: { $eq: ["$$t._id", "$ticket"] }
              }
            }
          },
          quantity: { $size: "$buyers" }
        }
      },

      // 🔹 Calculate revenue per transaction
      {
        $addFields: {
          revenue: {
            $cond: [
              { $eq: ["$status", "completed"] },
              { $multiply: ["$quantity", "$ticketInfo.price"] },
              0
            ]
          }
        }
      },

      // 🔹 Facet for pagination and totals
      {
        $facet: {
          history: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                txnId: 1,
                paystackId: 1,
                status: 1,
                createdAt: 1,
                quantity: 1,
                revenue: 1,
                buyerEmail: { $arrayElemAt: ["$buyers.email", 0] },
                ticket: "$ticketInfo",
                event: "$event.eventDetails"
              }
            }
          ],

          totals: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$revenue" },
                totalPending: {
                  $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                },
                totalFailed: {
                  $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                },
                totalCompleted: {
                  $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                }
              }
            }
          ],

          count: [{ $count: "total" }]
        }
      }
    ]);

    const totals = result.totals[0] || { 
      totalRevenue: 0,
      totalPending: 0,
      totalFailed: 0,
      totalCompleted: 0
    };

    const total = result.count[0]?.total || 0;

    return {
      totals,
      history: result.history,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  } catch (error: any) {
    throw new Error(`Error fetching transactions: ${error.message}`);
  }
}

  /**
   * ===============================
   * EVENTS LIST + TRANSACTION SUMMARY
   * (drives the "all events" landing view)
   * ===============================
   */
  async getEventsTransactionSummary(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [result] = await eventModel.aggregate([
        // 🔹 Pull in all transactions for each event (events with none get [])
        {
          $lookup: {
            from: transactionHistoryModel.collection.name,
            localField: "_id",
            foreignField: "event",
            as: "transactions"
          }
        },

        // 🔹 Per-transaction quantity/revenue, then collapse to per-event totals
        {
          $addFields: {
            summary: {
              $reduce: {
                input: "$transactions",
                initialValue: {
                  totalRevenue: 0,
                  totalTicketsSold: 0,
                  totalTransactions: 0,
                  totalPending: 0,
                  totalFailed: 0,
                  totalCompleted: 0,
                  lastTransactionAt: null
                },
                in: {
                  totalRevenue: {
                    $add: [
                      "$$value.totalRevenue",
                      {
                        $cond: [
                          { $eq: ["$$this.status", "completed"] },
                          {
                            $multiply: [
                              { $size: "$$this.buyers" },
                              {
                                $ifNull: [
                                  {
                                    $first: {
                                      $map: {
                                        input: {
                                          $filter: {
                                            input: "$tickets",
                                            as: "t",
                                            cond: { $eq: ["$$t._id", "$$this.ticket"] }
                                          }
                                        },
                                        as: "matched",
                                        in: "$$matched.price"
                                      }
                                    }
                                  },
                                  0
                                ]
                              }
                            ]
                          },
                          0
                        ]
                      }
                    ]
                  },
                  totalTicketsSold: {
                    $add: [
                      "$$value.totalTicketsSold",
                      {
                        $cond: [
                          { $eq: ["$$this.status", "completed"] },
                          { $size: "$$this.buyers" },
                          0
                        ]
                      }
                    ]
                  },
                  totalTransactions: { $add: ["$$value.totalTransactions", 1] },
                  totalPending: {
                    $add: [
                      "$$value.totalPending",
                      { $cond: [{ $eq: ["$$this.status", "pending"] }, 1, 0] }
                    ]
                  },
                  totalFailed: {
                    $add: [
                      "$$value.totalFailed",
                      { $cond: [{ $eq: ["$$this.status", "failed"] }, 1, 0] }
                    ]
                  },
                  totalCompleted: {
                    $add: [
                      "$$value.totalCompleted",
                      { $cond: [{ $eq: ["$$this.status", "completed"] }, 1, 0] }
                    ]
                  },
                  lastTransactionAt: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ["$$value.lastTransactionAt", null] },
                          { $gt: ["$$this.createdAt", "$$value.lastTransactionAt"] }
                        ]
                      },
                      "$$this.createdAt",
                      "$$value.lastTransactionAt"
                    ]
                  }
                }
              }
            }
          }
        },

        {
          $facet: {
            events: [
              // Most recently active events first; events with no sales yet
              // fall back to event creation date so they aren't buried.
              {
                $addFields: {
                  sortKey: { $ifNull: ["$summary.lastTransactionAt", "$createdAt"] }
                }
              },
              { $sort: { sortKey: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  eventTitle: "$eventDetails.eventTitle",
                  eventBanner: "$eventDetails.eventBanner",
                  venue: "$eventDetails.venue",
                  startDate: "$eventDetails.startDate",
                  endDate: "$eventDetails.endDate",
                  eventVisibility: "$eventDetails.eventVisibility",
                  published: 1,
                  totalRevenue: "$summary.totalRevenue",
                  totalTicketsSold: "$summary.totalTicketsSold",
                  totalTransactions: "$summary.totalTransactions",
                  totalPending: "$summary.totalPending",
                  totalFailed: "$summary.totalFailed",
                  totalCompleted: "$summary.totalCompleted",
                  lastTransactionAt: "$summary.lastTransactionAt"
                }
              }
            ],
            count: [{ $count: "total" }]
          }
        }
      ]);

      const total = result.count[0]?.total || 0;

      return {
        events: result.events,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error: any) {
      throw new Error(`Error fetching event transaction summary: ${error.message}`);
    }
  }

  /**
   * ===============================
   * TRANSACTIONS FOR A SINGLE EVENT
   * (drill-down when an event is clicked)
   * ===============================
   */
  async getTransactionsByEvent(eventId: string, page: number = 1, limit: number = 10) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const err: any = new Error("Invalid event id");
      err.statusCode = 400;
      throw err;
    }

    try {
      const skip = (page - 1) * limit;
      const eventObjectId = new mongoose.Types.ObjectId(eventId);

      const event = await eventModel
        .findById(eventObjectId)
        .select("eventDetails published")
        .lean();

      if (!event) {
        const err: any = new Error("Event not found");
        err.statusCode = 404;
        throw err;
      }

      const [result] = await transactionHistoryModel.aggregate([
        { $match: { event: eventObjectId } },

        {
          $lookup: {
            from: "events",
            localField: "event",
            foreignField: "_id",
            as: "event"
          }
        },
        { $unwind: "$event" },

        {
          $addFields: {
            ticketInfo: {
              $first: {
                $filter: {
                  input: "$event.tickets",
                  as: "t",
                  cond: { $eq: ["$$t._id", "$ticket"] }
                }
              }
            },
            quantity: { $size: "$buyers" }
          }
        },

        {
          $addFields: {
            revenue: {
              $cond: [
                { $eq: ["$status", "completed"] },
                { $multiply: ["$quantity", "$ticketInfo.price"] },
                0
              ]
            },
            checkedInCount: {
              $size: {
                $filter: {
                  input: "$buyers",
                  as: "b",
                  cond: { $eq: ["$$b.checkedIn", true] }
                }
              }
            }
          }
        },

        {
          $facet: {
            history: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  txnId: 1,
                  paystackId: 1,
                  status: 1,
                  createdAt: 1,
                  quantity: 1,
                  revenue: 1,
                  checkedInCount: 1,
                  buyerEmail: { $arrayElemAt: ["$buyers.email", 0] },
                  buyers: 1,
                  ticket: "$ticketInfo"
                }
              }
            ],
            totals: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: "$revenue" },
                  totalPending: {
                    $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                  },
                  totalFailed: {
                    $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                  },
                  totalCompleted: {
                    $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                  },
                  totalCheckedIn: { $sum: "$checkedInCount" }
                }
              }
            ],
            count: [{ $count: "total" }]
          }
        }
      ]);

      const totals = result.totals[0] || {
        totalRevenue: 0,
        totalPending: 0,
        totalFailed: 0,
        totalCompleted: 0,
        totalCheckedIn: 0
      };

      const total = result.count[0]?.total || 0;

      return {
        event: {
          _id: event._id,
          eventTitle: event.eventDetails.eventTitle,
          eventBanner: event.eventDetails.eventBanner,
          venue: event.eventDetails.venue,
          startDate: event.eventDetails.startDate,
          endDate: event.eventDetails.endDate,
          published: event.published
        },
        totals,
        history: result.history,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error: any) {
      if (error.statusCode) throw error;
      throw new Error(`Error fetching transactions for event: ${error.message}`);
    }
  }

  /**
   * ===============================
   * TICKETS SOLD (RANGE-AWARE)
   * ===============================
   */
  private async getTicketsSoldStats(dateRange: DashboardDateRange) {
    const currentMatch = buildDateMatch("createdAt", dateRange.current);
    const previousMatch = buildDateMatch("createdAt", dateRange.previous);

    // "Tickets sold" must count actual buyers, not transactions — a
    // single completed transaction can carry multiple buyers (a group
    // purchase), and each buyer is one ticket.
    const sumTicketsInWindow = async (match: Record<string, any> | null) => {
      const [result] = await transactionHistoryModel.aggregate([
        {
          $match: {
            status: "completed",
            ...(match || {})
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $size: "$buyers" } }
          }
        }
      ]);

      return result?.total || 0;
    };

    const [current, previous] = await Promise.all([
      sumTicketsInWindow(currentMatch),
      previousMatch ? sumTicketsInWindow(previousMatch) : Promise.resolve(null)
    ]);

    return this.withTrend(current, previous, "currentPeriod", "previousPeriod");
  }

  /**
   * ===============================
   * REVENUE (RANGE-AWARE)
   * ===============================
   */
  private async getRevenueStats(dateRange: DashboardDateRange) {
    const currentMatch = buildDateMatch("createdAt", dateRange.current);
    const previousMatch = buildDateMatch("createdAt", dateRange.previous);

    const sumRevenueInWindow = async (match: Record<string, any> | null) => {
      if (dateRange.previous && match === null) return null; // no previous window (shouldn't hit for revenue)

      const [result] = await transactionHistoryModel.aggregate([
        {
          $match: {
            status: "completed",
            ...(match || {})
          }
        },
        {
          $lookup: {
            from: "events",
            localField: "event",
            foreignField: "_id",
            as: "event"
          }
        },
        { $unwind: "$event" },
        {
          $addFields: {
            ticketInfo: {
              $first: {
                $filter: {
                  input: "$event.tickets",
                  as: "t",
                  cond: { $eq: ["$$t._id", "$ticket"] }
                }
              }
            },
            quantity: { $size: "$buyers" }
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $multiply: ["$quantity", "$ticketInfo.price"] } }
          }
        }
      ]);

      return result?.revenue || 0;
    };

    const [current, previous] = await Promise.all([
      sumRevenueInWindow(currentMatch),
      dateRange.previous ? sumRevenueInWindow(previousMatch) : Promise.resolve(null)
    ]);

    const trend = this.withTrend(current, previous, "currentPeriod", "previousPeriod");

    return {
      ...trend,
      currentPeriod: Number(trend.currentPeriod.toFixed(2)),
      previousPeriod:
        trend.previousPeriod === null ? null : Number(trend.previousPeriod.toFixed(2)),
      currency: "NGN"
    };
  }

  /**
   * Shared percentage-change/trend calculator. `previous === null` means
   * there is no comparable prior period (i.e. range === "all"), in which
   * case trend reporting is intentionally omitted rather than faked.
   */
  private withTrend(
    current: number,
    previous: number | null,
    currentKey: string,
    previousKey: string
  ) {
    if (previous === null) {
      return {
        [currentKey]: current,
        [previousKey]: null,
        percentageChange: null,
        trend: null
      } as any;
    }

    const percentageChange =
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

    return {
      [currentKey]: current,
      [previousKey]: previous,
      percentageChange: Number(percentageChange.toFixed(2)),
      trend: percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable"
    } as any;
  }

  /**
   * ===============================
   * DASHBOARD (CACHED, RANGE-AWARE)
   * ===============================
   */
  async getDashboardStats(range: DashboardRange = "all") {
    const redis = await getRedisClient();
    const cacheKey = `${DASHBOARD_CACHE_KEY}:${range}`;

    // 🔹 Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 🔹 Compute fresh
    const dateRange = getDashboardDateRange(range);
    const [ticketsSold, revenue] = await Promise.all([
      this.getTicketsSoldStats(dateRange),
      this.getRevenueStats(dateRange)
    ]);

    const data = {
      range,
      ticketsSold,
      revenue,
      generatedAt: new Date()
    };

    // 🔹 Save to Redis
    await redis.setEx(cacheKey, DASHBOARD_CACHE_TTL, JSON.stringify(data));

    return data;
  }

  /**
   * ===============================
   * CACHE INVALIDATION
   * ===============================
   */
  async invalidateDashboardCache() {
    const redis = await getRedisClient();
    await Promise.all(
      DASHBOARD_RANGES.map(range => redis.del(`${DASHBOARD_CACHE_KEY}:${range}`))
    );
  }
  /**
   * ===============================
   * BUYER EMAILS FOR AN EVENT
   * (used to send post-event communications, e.g. feedback requests)
   * ===============================
   * Only buyers from COMPLETED transactions are returned — pending
   * and failed transactions never actually attended/paid, and
   * shouldn't receive post-event mail. Deduplicated by email, since
   * a single buyer can appear in multiple transactions (or multiple
   * times within one group purchase).
   */
  async getCompletedBuyerEmailsForEvent(
    eventId: string
  ): Promise<{ email: string; fullName: string }[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const err: any = new Error("Invalid event id");
      err.statusCode = 400;
      throw err;
    }

    const results = await transactionHistoryModel.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          status: "completed",
        },
      },
      { $unwind: "$buyers" },
      {
        $group: {
          _id: { $toLower: "$buyers.email" },
          fullName: { $first: "$buyers.fullName" },
        },
      },
      {
        $project: {
          _id: 0,
          email: "$_id",
          fullName: 1,
        },
      },
    ]);

    return results;
  }
}

export default new TransactionService();