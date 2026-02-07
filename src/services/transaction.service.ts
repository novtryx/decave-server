import transactionHistoryModel from "../models/transactionHistory.model";
import { getRedisClient } from "../config/redis";

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
   * TICKETS SOLD (MONTHLY)
   * ===============================
   */
  private async getTicketsSoldStats() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const stats = await transactionHistoryModel.aggregate([
      {
        $match: {
          status: "completed"
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const current = stats.find(
      s => s._id.month === currentMonth && s._id.year === currentYear
    )?.count || 0;

    const last = stats.find(
      s => s._id.month === currentMonth - 1 && s._id.year === currentYear
    )?.count || 0;

    const percentageChange =
      last > 0 ? ((current - last) / last) * 100 : current > 0 ? 100 : 0;

    return {
      currentMonth: current,
      lastMonth: last,
      percentageChange: Number(percentageChange.toFixed(2)),
      trend:
        percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable"
    };
  }

  /**
   * ===============================
   * REVENUE (MONTHLY)
   * ===============================
   */
  private async getRevenueStats() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const stats = await transactionHistoryModel.aggregate([
      {
        $match: {
          status: "completed"
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
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          revenue: {
            $sum: { $multiply: ["$quantity", "$ticketInfo.price"] }
          }
        }
      }
    ]);

    const current = stats.find(
      s => s._id.month === currentMonth && s._id.year === currentYear
    )?.revenue || 0;

    const last = stats.find(
      s => s._id.month === currentMonth - 1 && s._id.year === currentYear
    )?.revenue || 0;

    const percentageChange =
      last > 0 ? ((current - last) / last) * 100 : current > 0 ? 100 : 0;

    return {
      currentMonth: Number(current.toFixed(2)),
      lastMonth: Number(last.toFixed(2)),
      percentageChange: Number(percentageChange.toFixed(2)),
      trend:
        percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable",
      currency: "NGN"
    };
  }

  /**
   * ===============================
   * DASHBOARD (CACHED)
   * ===============================
   */
  async getDashboardStats() {
    const redis = await getRedisClient();

    // 🔹 Try cache first
    const cached = await redis.get(DASHBOARD_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    // 🔹 Compute fresh
    const [ticketsSold, revenue] = await Promise.all([
      this.getTicketsSoldStats(),
      this.getRevenueStats()
    ]);

    const data = {
      ticketsSold,
      revenue,
      generatedAt: new Date()
    };

    // 🔹 Save to Redis
    await redis.setEx(
      DASHBOARD_CACHE_KEY,
      DASHBOARD_CACHE_TTL,
      JSON.stringify(data)
    );

    return data;
  }

  /**
   * ===============================
   * CACHE INVALIDATION
   * ===============================
   */
  async invalidateDashboardCache() {
    const redis = await getRedisClient();
    await redis.del(DASHBOARD_CACHE_KEY);
  }
}

export default new TransactionService();
