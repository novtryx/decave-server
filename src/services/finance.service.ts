import mongoose from "mongoose";
import financeEntryModel, { FinanceEntryType } from "../models/financeEntry.model";
import transactionHistoryModel from "../models/transactionHistory.model";
import eventModel from "../models/event.model";

const REVENUE_STATUSES = ["completed", "manually_verified"];

export interface FinanceEntryInput {
  eventId?: string | null;
  type: FinanceEntryType;
  category: string;
  amount: number;
  currency?: string;
  description?: string;
  date?: string | Date;
}

export interface FinanceEntryFilters {
  eventId?: string;
  type?: FinanceEntryType;
  category?: string;
  from?: string;
  to?: string;
}

export class FinanceService {
  async createEntry(input: FinanceEntryInput, createdBy: string) {
    if (input.eventId && !mongoose.Types.ObjectId.isValid(input.eventId)) {
      const err: any = new Error("Invalid event id");
      err.statusCode = 400;
      throw err;
    }
    if (!input.amount || input.amount <= 0) {
      const err: any = new Error("Amount must be greater than 0");
      err.statusCode = 400;
      throw err;
    }

    return financeEntryModel.create({
      event: input.eventId || null,
      type: input.type,
      category: input.category,
      amount: input.amount,
      currency: input.currency || "NGN",
      description: input.description || "",
      date: input.date ? new Date(input.date) : new Date(),
      createdBy,
    });
  }

  async updateEntry(entryId: string, input: Partial<FinanceEntryInput>) {
    const entry = await financeEntryModel.findById(entryId);
    if (!entry) {
      const err: any = new Error("Finance entry not found");
      err.statusCode = 404;
      throw err;
    }

    if (input.eventId !== undefined) entry.event = (input.eventId || null) as any;
    if (input.type !== undefined) entry.type = input.type;
    if (input.category !== undefined) entry.category = input.category;
    if (input.amount !== undefined) entry.amount = input.amount;
    if (input.currency !== undefined) entry.currency = input.currency;
    if (input.description !== undefined) entry.description = input.description;
    if (input.date !== undefined) entry.date = new Date(input.date);

    await entry.save();
    return entry;
  }

  async deleteEntry(entryId: string) {
    const deleted = await financeEntryModel.findByIdAndDelete(entryId);
    if (!deleted) {
      const err: any = new Error("Finance entry not found");
      err.statusCode = 404;
      throw err;
    }
    return deleted;
  }

  async getEntries(filters: FinanceEntryFilters = {}, page: number = 1, limit: number = 20) {
    const match: Record<string, any> = {};

    if (filters.eventId) {
      if (filters.eventId === "unassigned") {
        match.event = null;
      } else if (mongoose.Types.ObjectId.isValid(filters.eventId)) {
        match.event = new mongoose.Types.ObjectId(filters.eventId);
      }
    }
    if (filters.type) match.type = filters.type;
    if (filters.category) match.category = filters.category;
    if (filters.from || filters.to) {
      match.date = {};
      if (filters.from) match.date.$gte = new Date(filters.from);
      if (filters.to) match.date.$lte = new Date(filters.to);
    }

    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      financeEntryModel
        .find(match)
        .populate("event", "eventDetails.eventTitle")
        .populate("createdBy", "fullName email")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      financeEntryModel.countDocuments(match),
    ]);

    return {
      data: entries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Sums manual credit/debit entries for one event (or "unassigned"
   * for general company entries with no event attached).
   */
  private async getManualTotals(eventMatch: any) {
    const rows = await financeEntryModel.aggregate([
      { $match: eventMatch },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]);

    const totals = { manualCredits: 0, manualDebits: 0 };
    rows.forEach((r: any) => {
      if (r._id === "credit") totals.manualCredits = r.total;
      if (r._id === "debit") totals.manualDebits = r.total;
    });
    return totals;
  }

  /**
   * Full finance picture for one event: real ticket revenue (pulled
   * live from TransactionHistory — never duplicated here), plus every
   * manual credit/debit logged against it, rolled up into a
   * profit/loss figure.
   */
  async getEventFinanceSummary(eventId: string) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const err: any = new Error("Invalid event id");
      err.statusCode = 400;
      throw err;
    }

    const eventObjectId = new mongoose.Types.ObjectId(eventId);
    const event = await eventModel.findById(eventObjectId).lean<any>();
    if (!event) {
      const err: any = new Error("Event not found");
      err.statusCode = 404;
      throw err;
    }

    // Real ticket revenue — same source of truth as the event
    // analytics page, so the two never disagree.
    const revenueRows = await transactionHistoryModel.aggregate([
      { $match: { event: eventObjectId, status: { $in: REVENUE_STATUSES } } },
      {
        $lookup: { from: "events", localField: "event", foreignField: "_id", as: "eventData" },
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
          _id: null,
          ticketRevenue: { $sum: { $multiply: [{ $size: "$buyers" }, { $ifNull: ["$ticketInfo.price", 0] }] } },
        },
      },
    ]);

    const refundRows = await transactionHistoryModel.aggregate([
      { $match: { event: eventObjectId, status: "refunded" } },
      { $group: { _id: null, total: { $sum: "$refund.amount" } } },
    ]);

    const ticketRevenue = revenueRows[0]?.ticketRevenue || 0;
    const refundedAmount = refundRows[0]?.total || 0;
    const netTicketRevenue = Math.max(0, ticketRevenue - refundedAmount);

    const { manualCredits, manualDebits } = await this.getManualTotals({ event: eventObjectId });

    const totalRevenue = netTicketRevenue + manualCredits;
    const totalExpenses = manualDebits;
    const profit = totalRevenue - totalExpenses;

    // Category breakdown for the expense side — useful for "where is
    // the money going" at a glance.
    const expenseByCategory = await financeEntryModel.aggregate([
      { $match: { event: eventObjectId, type: "debit" } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]);

    return {
      eventId,
      eventTitle: event.eventDetails?.eventTitle,
      ticketRevenue,
      refundedAmount,
      netTicketRevenue,
      manualCredits,
      manualDebits,
      totalRevenue,
      totalExpenses,
      profit,
      expenseByCategory: expenseByCategory.map((r: any) => ({ category: r._id, total: r.total })),
    };
  }

  /**
   * All-time rollup: every event's ticket revenue + manual entries,
   * plus unassigned (general/company-wide) manual entries kept
   * separate so they don't get silently folded into one event.
   */
  async getFinanceOverview() {
    const events = await eventModel.find({}).select("eventDetails.eventTitle").lean();

    const perEvent = await Promise.all(
      events.map(async (ev: any) => {
        try {
          const summary = await this.getEventFinanceSummary(ev._id.toString());
          return summary;
        } catch {
          return null;
        }
      })
    );

    const validSummaries = perEvent.filter(Boolean) as any[];

    const { manualCredits: unassignedCredits, manualDebits: unassignedDebits } =
      await this.getManualTotals({ event: null });

    const totals = validSummaries.reduce(
      (acc, s) => {
        acc.totalRevenue += s.totalRevenue;
        acc.totalExpenses += s.totalExpenses;
        acc.profit += s.profit;
        return acc;
      },
      { totalRevenue: 0, totalExpenses: 0, profit: 0 }
    );

    totals.totalRevenue += unassignedCredits;
    totals.totalExpenses += unassignedDebits;
    totals.profit += unassignedCredits - unassignedDebits;

    return {
      allTime: totals,
      unassigned: { credits: unassignedCredits, debits: unassignedDebits },
      events: validSummaries.sort((a, b) => b.profit - a.profit),
    };
  }
}

export default new FinanceService();
