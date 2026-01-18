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

            const data = await transactionHistoryModel.find()
                .select("txnId event paystackId ticket status createdAt _id buyers")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(); // ← Add this to get plain JS objects

            const total = await transactionHistoryModel.countDocuments();

            const history = await Promise.all(
                data.map(async (h) => {
                    const event = await eventModel
                        .findById(h.event)
                        .select("eventDetails tickets")
                        .lean();

                    const ticket = event?.tickets?.find(t => t._id.toString() === h.ticket.toString()); // Added return and toString()

                    return {
                        ...h,
                        buyers: h.buyers[0]?.email || null,
                        event: event?.eventDetails || null,
                        ticket: ticket || null
                    };
                })
            );

            return {
                history,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1,
                },
            };
        } catch (error: any) {
            throw new Error(`Error fetching transactions: ${error.message}`); // Fixed error message
        }
    }
}
export default new TransactionService();