import { connectDB } from "../config/database";
import eventModel from "../models/event.model";
import transactionHistoryModel from "../models/transactionHistory.model";

export class TransactionService {
    private async ensureConnection() {
        await connectDB();
    }

    async getAllTransactions(page: number = 1, limit: number = 10) {
  try {
    await this.ensureConnection();

    const skip = (page - 1) * limit;

    const [result] = await transactionHistoryModel.aggregate([
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "event"
        }
      },
      { $unwind: "$event" },

      // 🔹 Resolve ticket from event.tickets
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

      // 🔹 Compute revenue per transaction
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

      {
        $facet: {
          // ================= HISTORY =================
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

          // ================= TOTALS =================
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

          // ================= COUNT =================
          count: [
            { $count: "total" }
          ]
        }
      }
    ]);

    return {
      totals: result.totals[0] || {
        totalRevenue: 0,
        totalPending: 0,
        totalFailed: 0,
        totalCompleted: 0
      },
      history: result.history,
      pagination: {
        total: result.count[0]?.total || 0,
        page,
        limit,
        pages: Math.ceil((result.count[0]?.total || 0) / limit),
        hasNext: page * limit < (result.count[0]?.total || 0),
        hasPrev: page > 1
      }
    };
  } catch (error: any) {
    throw new Error(`Error fetching transactions: ${error.message}`);
  }
}


    /**
     * Get total tickets sold with percentage change compared to last month
     */
    async getTicketsSoldStats() {
        try {
            await this.ensureConnection();

            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

            // Get current month tickets sold (successful transactions only)
            const currentMonthTickets = await transactionHistoryModel.countDocuments({
                status: "completed",
                createdAt: { $gte: currentMonthStart }
            });

            // Get last month tickets sold
            const lastMonthTickets = await transactionHistoryModel.countDocuments({
                status: "completed",
                createdAt: { 
                    $gte: lastMonthStart,
                    $lte: lastMonthEnd
                }
            });

            // Calculate percentage change
            let percentageChange = 0;
            if (lastMonthTickets > 0) {
                percentageChange = ((currentMonthTickets - lastMonthTickets) / lastMonthTickets) * 100;
            } else if (currentMonthTickets > 0) {
                percentageChange = 100; // If last month was 0 and current month has sales
            }

            return {
                currentMonth: currentMonthTickets,
                lastMonth: lastMonthTickets,
                percentageChange: parseFloat(percentageChange.toFixed(2)),
                trend: percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable"
            };
        } catch (error: any) {
            throw new Error(`Error fetching tickets sold stats: ${error.message}`);
        }
    }

    /**
     * Get total revenue with percentage change compared to last month
     */
    async getRevenueStats() {
        try {
            await this.ensureConnection();

            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

            // Get current month revenue
            const currentMonthRevenue = await this.calculateRevenue(currentMonthStart, now);

            // Get last month revenue
            const lastMonthRevenue = await this.calculateRevenue(lastMonthStart, lastMonthEnd);

            // Calculate percentage change
            let percentageChange = 0;
            if (lastMonthRevenue > 0) {
                percentageChange = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
            } else if (currentMonthRevenue > 0) {
                percentageChange = 100;
            }

            return {
                currentMonth: parseFloat(currentMonthRevenue.toFixed(2)),
                lastMonth: parseFloat(lastMonthRevenue.toFixed(2)),
                percentageChange: parseFloat(percentageChange.toFixed(2)),
                trend: percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable",
                currency: "NGN" // Adjust based on your currency
            };
        } catch (error: any) {
            throw new Error(`Error fetching revenue stats: ${error.message}`);
        }
    }

    /**
     * Helper method to calculate revenue for a date range
     */
  private async calculateRevenue(startDate: Date, endDate: Date): Promise<number> {
  const result = await transactionHistoryModel.aggregate([
    {
      $match: {
        status: "completed",
        createdAt: { $gte: startDate, $lte: endDate }
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
        totalRevenue: {
          $sum: {
            $multiply: ["$quantity", "$ticketInfo.price"]
          }
        }
      }
    }
  ]);

  return result[0]?.totalRevenue || 0;
}


    /**
     * Get combined dashboard stats
     */
    async getDashboardStats() {
        try {
            await this.ensureConnection();

            const [ticketStats, revenueStats] = await Promise.all([
                this.getTicketsSoldStats(),
                this.getRevenueStats()
            ]);

            return {
                ticketsSold: ticketStats,
                revenue: revenueStats,
                generatedAt: new Date()
            };
        } catch (error: any) {
            throw new Error(`Error fetching dashboard stats: ${error.message}`);
        }
    }
}

export default new TransactionService();