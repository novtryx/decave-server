import mongoose from "mongoose";
import transactionHistoryModel from "../models/transactionHistory.model";
import customerProfileModel from "../models/customerProfile.model";

const REVENUE_STATUSES = ["completed", "manually_verified"];

export interface CustomerFilters {
  search?: string;
  eventId?: string;
  ticketTierCategory?: string;
  minSpend?: number;
  maxSpend?: number;
  attendanceStatus?: "checked_in" | "never_checked_in";
  tag?: string;
}

export class CrmService {
  /**
   * Builds the buyer-level aggregation shared by list + count. Buyer
   * identity is their lowercased email — the one thing every buyer
   * has across every transaction, regardless of which event or which
   * ticket tier they bought.
   */
  private buildBaseAggregation() {
    return [
      { $match: { status: { $in: REVENUE_STATUSES } } },
      { $unwind: "$buyers" },
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
          _id: { $toLower: "$buyers.email" },
          fullName: { $last: "$buyers.fullName" },
          email: { $last: "$buyers.email" },
          phoneNumber: { $last: "$buyers.phoneNumber" },
          totalSpend: { $sum: { $ifNull: ["$ticketInfo.price", 0] } },
          ticketsPurchased: { $sum: 1 },
          checkedInCount: { $sum: { $cond: ["$buyers.checkedIn", 1, 0] } },
          events: { $addToSet: "$event" },
          tierCategories: { $push: { $ifNull: ["$ticketInfo.tierCategory", "standard"] } },
          hasInfluencerReferral: { $max: { $cond: [{ $ifNull: ["$influencer", false] }, 1, 0] } },
          referralSources: { $addToSet: { $ifNull: ["$referralSource", null] } },
          firstPurchaseDate: { $min: "$createdAt" },
          lastPurchaseDate: { $max: "$createdAt" },
        },
      },
      {
        $addFields: {
          eventsAttendedCount: { $size: "$events" },
        },
      },
    ];
  }

  private deriveAutoTags(row: any): string[] {
    const tags: string[] = [];
    if (row.eventsAttendedCount <= 1) tags.push("first_time_buyer");
    else tags.push("regular_buyer");

    if (row.tierCategories?.includes("vip")) tags.push("vip");
    if (row.tierCategories?.includes("table")) tags.push("table_buyer");
    if (row.tierCategories?.includes("sponsor_guest")) tags.push("sponsor_guest");
    if (row.hasInfluencerReferral) tags.push("influencer_referral");

    return tags;
  }

  private deriveReferralSource(row: any): string {
    if (row.hasInfluencerReferral) return "influencer";
    const sources = (row.referralSources || []).filter(Boolean);
    return sources[0] || "direct";
  }

  /**
   * Paginated, filterable customer list. Filters that depend on
   * derived fields (event attended, tier bought, spend range, tag)
   * are applied in a second $match stage after grouping, since they
   * only make sense once we know a buyer's full history.
   */
  async getCustomers(filters: CustomerFilters = {}, page: number = 1, limit: number = 20) {
    const pipeline: any[] = [...this.buildBaseAggregation()];

    const postMatch: Record<string, any> = {};
    if (filters.eventId && mongoose.Types.ObjectId.isValid(filters.eventId)) {
      postMatch.events = new mongoose.Types.ObjectId(filters.eventId);
    }
    if (filters.ticketTierCategory) {
      postMatch.tierCategories = filters.ticketTierCategory;
    }
    if (filters.minSpend !== undefined || filters.maxSpend !== undefined) {
      postMatch.totalSpend = {};
      if (filters.minSpend !== undefined) postMatch.totalSpend.$gte = filters.minSpend;
      if (filters.maxSpend !== undefined) postMatch.totalSpend.$lte = filters.maxSpend;
    }
    if (filters.attendanceStatus === "checked_in") {
      postMatch.checkedInCount = { $gt: 0 };
    } else if (filters.attendanceStatus === "never_checked_in") {
      postMatch.checkedInCount = 0;
    }
    if (filters.search) {
      const re = new RegExp(filters.search.trim(), "i");
      postMatch.$or = [{ fullName: re }, { email: re }, { phoneNumber: re }];
    }

    if (Object.keys(postMatch).length > 0) {
      pipeline.push({ $match: postMatch });
    }

    pipeline.push({ $sort: { totalSpend: -1 } });

    const countPipeline = [...pipeline, { $count: "total" }];
    const skip = (page - 1) * limit;
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [rows, countResult] = await Promise.all([
      transactionHistoryModel.aggregate(dataPipeline),
      transactionHistoryModel.aggregate(countPipeline),
    ]);

    const emails = rows.map((r: any) => r.email?.toLowerCase()).filter(Boolean);
    const manualProfiles = await customerProfileModel
      .find({ email: { $in: emails } })
      .lean();
    const manualTagsByEmail = new Map<string, { tags: string[]; notes?: string }>();
    manualProfiles.forEach((p: any) => manualTagsByEmail.set(p.email, { tags: p.tags || [], notes: p.notes }));

    let customers = rows.map((row: any) => {
      const manual = manualTagsByEmail.get(row.email?.toLowerCase()) || { tags: [], notes: "" };
      const autoTags = this.deriveAutoTags(row);
      return {
        email: row.email,
        fullName: row.fullName,
        phoneNumber: row.phoneNumber,
        totalSpend: row.totalSpend,
        ticketsPurchased: row.ticketsPurchased,
        eventsAttendedCount: row.eventsAttendedCount,
        checkedInCount: row.checkedInCount,
        referralSource: this.deriveReferralSource(row),
        firstPurchaseDate: row.firstPurchaseDate,
        lastPurchaseDate: row.lastPurchaseDate,
        tags: Array.from(new Set([...autoTags, ...manual.tags])),
        notes: manual.notes || "",
      };
    });

    // Tag filter has to run after merging manual + auto tags, so it
    // stays in JS rather than the Mongo pipeline.
    if (filters.tag) {
      customers = customers.filter((c) => c.tags.includes(filters.tag as string));
    }

    const total = countResult[0]?.total || 0;

    return {
      data: customers,
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
   * Full purchase + check-in history for one buyer, plus their
   * tag/notes profile. Used for the CRM detail drawer.
   */
  async getCustomerDetail(email: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const transactions = await transactionHistoryModel
      .find({ "buyers.email": { $regex: new RegExp(`^${normalizedEmail}$`, "i") } })
      .populate("event", "eventDetails.eventTitle eventDetails.startDate eventDetails.eventBanner")
      .sort({ createdAt: -1 })
      .lean();

    if (transactions.length === 0) {
      const err: any = new Error("Customer not found");
      err.statusCode = 404;
      throw err;
    }

    const history = transactions.map((t: any) => {
      const buyer = (t.buyers || []).find(
        (b: any) => b.email?.toLowerCase() === normalizedEmail
      );
      return {
        transactionId: t._id,
        txnId: t.txnId,
        status: t.status,
        eventId: t.event?._id,
        eventTitle: t.event?.eventDetails?.eventTitle,
        eventDate: t.event?.eventDetails?.startDate,
        checkedIn: buyer?.checkedIn || false,
        ticketId: buyer?.ticketId,
        referralSource: t.referralSource || (t.influencer ? "influencer" : "direct"),
        createdAt: t.createdAt,
      };
    });

    const profile = await customerProfileModel.findOne({ email: normalizedEmail }).lean<any>();
    const firstTxn = transactions[transactions.length - 1] as any;
    const anyBuyer = (firstTxn.buyers || [])[0];

    return {
      email: normalizedEmail,
      fullName: anyBuyer?.fullName,
      phoneNumber: anyBuyer?.phoneNumber,
      tags: profile?.tags || [],
      notes: profile?.notes || "",
      totalTransactions: transactions.length,
      history,
    };
  }

  /**
   * Upsert manual tags/notes for a buyer. Auto-derived tags (VIP,
   * first_time_buyer, etc) are never stored here — only overrides
   * like "vendor" or "press" that can't be inferred from ticket data.
   */
  async setCustomerTags(email: string, tags: string[], notes?: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const updated = await customerProfileModel.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: { tags, ...(notes !== undefined && { notes }) } },
      { upsert: true, new: true }
    );

    return updated;
  }
}

export default new CrmService();