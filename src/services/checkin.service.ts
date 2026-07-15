import mongoose from "mongoose";
import transactionHistoryModel from "../models/transactionHistory.model";
import eventModel from "../models/event.model";

const REVENUE_STATUSES = ["completed", "manually_verified"];

/**
 * A scanned QR code is the URL baked into the ticket PDF/email:
 * https://decavemgt.com/ticket?txnId=...&ticketId=...
 * This pulls txnId/ticketId out of that URL, a bare query string, or
 * (as a last resort) treats the whole scanned value as a ticketId —
 * so it's tolerant of whatever a scanner app hands it.
 */
function parseScannedCode(raw: string): { txnId?: string; ticketId?: string } {
  const trimmed = raw.trim();

  try {
    const url = new URL(trimmed);
    const txnId = url.searchParams.get("txnId") || undefined;
    const ticketId = url.searchParams.get("ticketId") || undefined;
    if (txnId || ticketId) return { txnId, ticketId };
  } catch {
    // not a URL — fall through
  }

  if (trimmed.includes("txnId=") || trimmed.includes("ticketId=")) {
    const params = new URLSearchParams(trimmed.replace(/^\?/, ""));
    const txnId = params.get("txnId") || undefined;
    const ticketId = params.get("ticketId") || undefined;
    if (txnId || ticketId) return { txnId, ticketId };
  }

  // Last resort: treat the raw value as a bare ticketId.
  return { ticketId: trimmed };
}

export class CheckInService {
  /**
   * Core check-in logic shared by QR scan and manual search results.
   * Looks a buyer up by ticketId (optionally narrowed by txnId),
   * refuses unpaid transactions, and flags — rather than silently
   * ignoring — a second scan of the same ticket.
   */
  private async performCheckIn(txnId: string | undefined, ticketId: string | undefined, scannedBy: string) {
    if (!txnId && !ticketId) {
      const err: any = new Error("Could not read a ticket from that code");
      err.statusCode = 400;
      throw err;
    }

    const query: Record<string, any> = ticketId ? { "buyers.ticketId": ticketId } : { txnId };
    const transaction = await transactionHistoryModel.findOne(query).populate(
      "event",
      "eventDetails.eventTitle"
    );

    if (!transaction) {
      const err: any = new Error("Ticket not found");
      err.statusCode = 404;
      throw err;
    }

    if (!REVENUE_STATUSES.includes(transaction.status)) {
      const err: any = new Error(`This ticket's payment is ${transaction.status}, not confirmed`);
      err.statusCode = 400;
      throw err;
    }

    const buyerIndex = ticketId
      ? transaction.buyers.findIndex((b: any) => b.ticketId === ticketId)
      : 0; // single-buyer lookup by txnId only — used rarely, mainly for manual search results

    if (buyerIndex === -1) {
      const err: any = new Error("Ticket not found on this order");
      err.statusCode = 404;
      throw err;
    }

    const buyer: any = transaction.buyers[buyerIndex];

    if (buyer.checkedIn) {
      // Duplicate scan — return 200 with a flag rather than an error,
      // so the scanner UI can show a clear warning instead of a
      // generic failure.
      return {
        duplicate: true,
        buyer: {
          fullName: buyer.fullName,
          email: buyer.email,
          ticketId: buyer.ticketId,
          checkedInAt: buyer.checkedInAt,
        },
        eventTitle: (transaction.event as any)?.eventDetails?.eventTitle,
      };
    }

    buyer.checkedIn = true;
    buyer.checkedInAt = new Date();
    buyer.checkedInBy = scannedBy;
    await transaction.save();

    return {
      duplicate: false,
      buyer: {
        fullName: buyer.fullName,
        email: buyer.email,
        ticketId: buyer.ticketId,
        checkedInAt: buyer.checkedInAt,
      },
      eventTitle: (transaction.event as any)?.eventDetails?.eventTitle,
    };
  }

  async scan(rawCode: string, scannedBy: string) {
    const { txnId, ticketId } = parseScannedCode(rawCode);
    return this.performCheckIn(txnId, ticketId, scannedBy);
  }

  async manualCheckIn(txnId: string, ticketId: string, scannedBy: string) {
    return this.performCheckIn(txnId, ticketId, scannedBy);
  }

  /**
   * Free-text search across an event's buyers — by name, email,
   * phone, ticket code, or order/transaction reference. Used when a
   * guest's QR won't scan (dead phone, etc) and staff need to find
   * them by hand.
   */
  async search(eventId: string, query: string) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const err: any = new Error("Invalid event id");
      err.statusCode = 400;
      throw err;
    }

    const re = new RegExp(query.trim(), "i");

    const transactions = await transactionHistoryModel
      .find({
        event: new mongoose.Types.ObjectId(eventId),
        status: { $in: REVENUE_STATUSES },
        $or: [
          { txnId: re },
          { "buyers.fullName": re },
          { "buyers.email": re },
          { "buyers.phoneNumber": re },
          { "buyers.ticketId": re },
        ],
      })
      .select("txnId buyers ticket")
      .lean();

    const results: any[] = [];
    transactions.forEach((t: any) => {
      t.buyers.forEach((b: any) => {
        const matches =
          re.test(t.txnId) ||
          re.test(b.fullName) ||
          re.test(b.email) ||
          re.test(b.phoneNumber) ||
          re.test(b.ticketId);
        if (matches) {
          results.push({
            txnId: t.txnId,
            ticketId: b.ticketId,
            fullName: b.fullName,
            email: b.email,
            phoneNumber: b.phoneNumber,
            checkedIn: b.checkedIn,
            checkedInAt: b.checkedInAt,
          });
        }
      });
    });

    return results.slice(0, 25);
  }

  /**
   * Live door metrics for one event: expected vs checked-in vs not
   * yet arrived, peak entry hour, and gate-tier sales/revenue (people
   * who bought at the door rather than in advance).
   */
  async getLiveDoorMetrics(eventId: string) {
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

    const rows = await transactionHistoryModel.aggregate([
      { $match: { event: eventObjectId, status: { $in: REVENUE_STATUSES } } },
      { $unwind: "$buyers" },
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
        $project: {
          checkedIn: "$buyers.checkedIn",
          checkedInAt: "$buyers.checkedInAt",
          tierCategory: { $ifNull: ["$ticketInfo.tierCategory", "standard"] },
          price: { $ifNull: ["$ticketInfo.price", 0] },
        },
      },
    ]);

    const expectedGuests = rows.length;
    const checkedInGuests = rows.filter((r: any) => r.checkedIn).length;
    const notYetArrived = expectedGuests - checkedInGuests;

    const gateRows = rows.filter((r: any) => r.tierCategory === "gate");
    const gateSalesCount = gateRows.length;
    const doorRevenue = gateRows.reduce((sum: number, r: any) => sum + r.price, 0);

    // Peak entry hour — bucket check-in timestamps by hour of day.
    const hourCounts: Record<number, number> = {};
    rows.forEach((r: any) => {
      if (r.checkedInAt) {
        const hour = new Date(r.checkedInAt).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });
    let peakEntryHour: number | null = null;
    let peakCount = 0;
    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > peakCount) {
        peakCount = count;
        peakEntryHour = Number(hour);
      }
    });

    return {
      eventId,
      eventTitle: event.eventDetails?.eventTitle,
      expectedGuests,
      checkedInGuests,
      notYetArrived,
      checkInRate: expectedGuests > 0 ? Number(((checkedInGuests / expectedGuests) * 100).toFixed(1)) : 0,
      peakEntryHour,
      gateSalesCount,
      doorRevenue,
    };
  }

  /**
   * Full attendance list for the end-of-event export — every ticket
   * sold, whether it was used, and when.
   */
  async getAttendanceExport(eventId: string) {
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

    const transactions = await transactionHistoryModel
      .find({ event: eventObjectId, status: { $in: REVENUE_STATUSES } })
      .select("txnId ticket buyers")
      .lean();

    const ticketMap = new Map((event.tickets || []).map((t: any) => [t._id.toString(), t]));

    const rows: any[] = [];
    transactions.forEach((t: any) => {
      const ticketInfo: any = ticketMap.get(t.ticket.toString());
      t.buyers.forEach((b: any) => {
        rows.push({
          txnId: t.txnId,
          ticketId: b.ticketId,
          fullName: b.fullName,
          email: b.email,
          phoneNumber: b.phoneNumber,
          ticketName: ticketInfo?.ticketName || "—",
          tierCategory: ticketInfo?.tierCategory || "standard",
          checkedIn: b.checkedIn,
          checkedInAt: b.checkedInAt || null,
        });
      });
    });

    return {
      eventTitle: event.eventDetails?.eventTitle,
      rows,
    };
  }
}

export default new CheckInService();