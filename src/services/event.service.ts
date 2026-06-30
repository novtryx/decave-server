import mongoose from "mongoose";
import eventModel from "../models/event.model";
import transactionHistoryModel from "../models/transactionHistory.model";
import { IEvent } from "../types/database.types";
import { connectDB } from "../config/database";
import {
  DashboardRange,
  DashboardDateRange,
  getDashboardDateRange
} from "../utils/daterange";

export class EventService {
  private async ensureConnection() {
    await connectDB();
  }

  /**
   * Creates an Error tagged with an HTTP status code so controllers can
   * distinguish client errors (bad input / business rule violations)
   * from genuine server failures, instead of everything collapsing to 500.
   */
  private businessError(message: string, statusCode: number = 400): Error {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    return err;
  }

  // Create new event (Stage 1)
  async createEvent(eventData: Partial<IEvent>): Promise<IEvent> {
    try {
      await this.ensureConnection();

      const newEvent = new eventModel({
        stage: 1,
        published: false,
        eventDetails: eventData.eventDetails,
      });

      await newEvent.save();
      return newEvent;
    } catch (error: any) {
      throw new Error(`Error creating event: ${error.message}`);
    }
  }

  // Get event by ID
  async getEventById(id: string): Promise<IEvent | null> {
    try {
      await this.ensureConnection();
      return await eventModel.findById(id);
    } catch (error: any) {
      throw new Error(`Error fetching event: ${error.message}`);
    }
  }

  async getEventByName(eventTitle: string): Promise<IEvent | null> {
    try {
      await this.ensureConnection();
      return await eventModel.findOne({ "eventDetails.eventTitle": eventTitle });
    } catch (error: any) {
      throw new Error(`Error fetching event: ${error.message}`);
    }
  }
  // Get all events with pagination
  async getAllEvents(page: number = 1, limit: number = 10, filters?: any) {
    try {
      await this.ensureConnection();
      const skip = (page - 1) * limit;

      const query: any = {};
      
      // Apply filters
      if (filters?.published !== undefined) {
        query.published = filters.published;
      }
      if (filters?.stage) {
        query.stage = filters.stage;
      }
      if (filters?.eventVisibility !== undefined) {
        query["eventDetails.eventVisibility"] = filters.eventVisibility;
      }

      const events = await eventModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await eventModel.countDocuments(query);

      return {
        events,
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
      throw new Error(`Error fetching events: ${error.message}`);
    }
  }

  // Update event (any stage)
  /**
   * Sums completed sales for a single ticket type. This is the ground
   * truth used to stop edits from ever putting inventory in an
   * impossible state (e.g. fewer tickets printed than already sold).
   */
  private async getSoldQuantityForTicket(eventId: string, ticketId: string): Promise<number> {
    const [result] = await transactionHistoryModel.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          ticket: new mongoose.Types.ObjectId(ticketId),
          status: "completed",
        },
      },
      { $project: { count: { $size: "$buyers" } } },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]);

    return result?.total || 0;
  }

  async updateEvent(id: string, updateData: Partial<IEvent>): Promise<IEvent | null> {
    try {
      await this.ensureConnection();

      // ---------------------------------------------------------------
      // Guard: if a full `tickets` array is part of this update, make
      // sure no ticket that already has completed sales is silently
      // dropped (which would orphan transactions/QR codes/check-ins),
      // and no kept ticket's initialQuantity is set below what's
      // already been sold.
      // ---------------------------------------------------------------
      if (updateData.tickets) {
        const existingEvent = await eventModel.findById(id).lean();
        if (!existingEvent) {
          throw this.businessError("Event not found", 404);
        }

        const incomingIds = new Set(
          (updateData.tickets as any[])
            .map((t) => t._id?.toString())
            .filter(Boolean)
        );

        for (const existingTicket of existingEvent.tickets || []) {
          const ticketId = (existingTicket as any)._id.toString();
          const sold = await this.getSoldQuantityForTicket(id, ticketId);

          if (sold > 0 && !incomingIds.has(ticketId)) {
            throw this.businessError(
              `Cannot remove ticket "${existingTicket.ticketName}" — it has ${sold} completed sale(s) attached to it`,
              409
            );
          }
        }

        for (const incoming of updateData.tickets as any[]) {
          if (!incoming._id) continue; // brand-new ticket, nothing sold yet
          const sold = await this.getSoldQuantityForTicket(id, incoming._id.toString());

          if (sold > incoming.initialQuantity) {
            throw this.businessError(
              `Cannot set initial quantity for ticket "${incoming.ticketName}" below ${sold} — it already has ${sold} completed sale(s)`,
              409
            );
          }
        }
      }

      // Flatten nested objects to dot notation
      const flattenedUpdate: any = {};

      Object.keys(updateData).forEach(key => {
        if (key === 'aboutEvent' && updateData.aboutEvent) {
          // Handle aboutEvent specifically with dot notation
          flattenedUpdate['aboutEvent.heading'] = updateData.aboutEvent.heading;
          flattenedUpdate['aboutEvent.description'] = updateData.aboutEvent.description;
          flattenedUpdate['aboutEvent.content'] = updateData.aboutEvent.content;
        } else {
          flattenedUpdate[key] = (updateData as any)[key];
        }
      });

      const updatedEvent = await eventModel.findByIdAndUpdate(
        id,
        { $set: flattenedUpdate },
        { new: true, runValidators: true }
      );

      return updatedEvent;
    } catch (error: any) {
      if (error.statusCode) throw error;
      throw new Error(`Error updating event: ${error.message}`);
    }
  }


  /**
   * Updates a single ticket type in place, preserving its _id (and
   * therefore every transaction/QR code/check-in that references it).
   *
   * Quantity semantics are intentionally explicit and independent:
   *  - `initialQuantity` is the total print run. Changing it shifts
   *    `availableQuantity` by the same delta (raise it = restock,
   *    lower it = retire unsold stock), but can never drop below
   *    however many have already sold.
   *  - `availableQuantity` is the live, purchasable count. Setting it
   *    directly never touches `initialQuantity`, and can't exceed it.
   *
   * Price is immutable post-creation; if a caller attempts to change
   * it, that's surfaced as a warning rather than silently dropped.
   */
  async updateEventTicket(
    eventId: string,
    ticketId: string,
    updateData: Partial<{
      ticketName: string;
      price: number; // accepted in payload, never applied — see warnings
      currency: string;
      availableQuantity: number;
      initialQuantity: number;
      benefits: string[];
      saleStartDate: Date | null;
      saleEndDate: Date | null;
    }>
  ): Promise<{ event: IEvent; warnings: string[] }> {
    try {
      await this.ensureConnection();

      const event = await eventModel.findById(eventId);
      if (!event) throw this.businessError("Event not found", 404);

      const ticket = event.tickets.find(
        (t: any) => t._id.toString() === ticketId
      );
      if (!ticket) throw this.businessError("Ticket not found", 404);

      const warnings: string[] = [];
      if ((updateData as any).price !== undefined) {
        warnings.push(
          "Ticket price cannot be changed after creation; the supplied price was ignored"
        );
      }

      if (updateData.ticketName !== undefined) ticket.ticketName = updateData.ticketName;
      if (updateData.currency !== undefined) ticket.currency = updateData.currency;
      if (updateData.benefits !== undefined) ticket.benefits = updateData.benefits;
      if (updateData.saleStartDate !== undefined) (ticket as any).saleStartDate = updateData.saleStartDate;
      if (updateData.saleEndDate !== undefined) (ticket as any).saleEndDate = updateData.saleEndDate;

      const startDate = (ticket as any).saleStartDate;
      const endDate = (ticket as any).saleEndDate;
      if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
        throw this.businessError('"saleEndDate" must be after "saleStartDate"', 400);
      }

      // Ground truth: tickets actually sold so far for this type.
      const sold = await this.getSoldQuantityForTicket(eventId, ticketId);

      let nextInitial = ticket.initialQuantity;
      let nextAvailable = ticket.availableQuantity;

      if (updateData.initialQuantity !== undefined) {
        if (updateData.initialQuantity < sold) {
          throw this.businessError(
            `Initial quantity cannot be set below ${sold} — ${sold} ticket(s) of this type have already been sold`,
            409
          );
        }
        const delta = updateData.initialQuantity - nextInitial;
        nextInitial = updateData.initialQuantity;
        nextAvailable = Math.max(0, nextAvailable + delta);
      }

      if (updateData.availableQuantity !== undefined) {
        if (updateData.availableQuantity > nextInitial) {
          throw this.businessError(
            `Available quantity (${updateData.availableQuantity}) cannot exceed initial quantity (${nextInitial})`,
            400
          );
        }
        nextAvailable = updateData.availableQuantity;
      }

      ticket.initialQuantity = nextInitial;
      ticket.availableQuantity = nextAvailable;

      await event.save();
      return { event, warnings };

    } catch (error: any) {
      if (error.statusCode) throw error;
      throw new Error(
        `Error updating event ticket: ${error.message}`
      );
    }
  }




  async createEventTicket(
    eventId: string,
    data: {
      ticketName: string;
      price: number;
      currency?: string;
      initialQuantity: number;
      benefits?: string[];
      saleStartDate?: Date | null;
      saleEndDate?: Date | null;
    }
  ): Promise<IEvent | null> {
    try {
      await this.ensureConnection();

      const event = await eventModel.findById(eventId);
      if (!event) throw this.businessError("Event not found", 404);

      event.tickets.push({
        ticketName: data.ticketName,
        price: data.price,
        currency: data.currency ?? "NGN",
        initialQuantity: data.initialQuantity,
        availableQuantity: data.initialQuantity,
        benefits: data.benefits ?? [],
        saleStartDate: data.saleStartDate ?? null,
        saleEndDate: data.saleEndDate ?? null,
      } as any);

      await event.save();
      return event;

    } catch (error: any) {
      if (error.statusCode) throw error;
      throw new Error(
        `Error creating event ticket: ${error.message}`
      );
    }
  }




  // Update specific stage
  async updateEventStage(
    id: string,
    stage: number,
    stageData: any
  ): Promise<IEvent | null> {
    try {
      await this.ensureConnection();

      const event = await eventModel.findById(id);
      if (!event) {
        throw this.businessError("Event not found", 404);
      }

      // Update based on stage
      switch (stage) {
        case 1:
          event.eventDetails = stageData.eventDetails;
          break;
        case 2:
          event.aboutEvent = stageData.aboutEvent;
          event.stage = 2;
          break;
        case 3: {
          // Same safety net as the general update path: don't let a
          // resubmitted tickets array silently drop a ticket that
          // already has completed sales, or shrink one below what's
          // already sold.
          const incomingIds = new Set(
            (stageData.tickets as any[])
              .map((t) => t._id?.toString())
              .filter(Boolean)
          );

          for (const existingTicket of event.tickets || []) {
            const ticketId = (existingTicket as any)._id.toString();
            const sold = await this.getSoldQuantityForTicket(id, ticketId);

            if (sold > 0 && !incomingIds.has(ticketId)) {
              throw this.businessError(
                `Cannot remove ticket "${existingTicket.ticketName}" — it has ${sold} completed sale(s) attached to it`,
                409
              );
            }
          }

          for (const incoming of stageData.tickets as any[]) {
            if (!incoming._id) continue; // brand-new ticket, nothing sold yet
            const sold = await this.getSoldQuantityForTicket(id, incoming._id.toString());

            if (sold > incoming.initialQuantity) {
              throw this.businessError(
                `Cannot set initial quantity for ticket "${incoming.ticketName}" below ${sold} — it already has ${sold} completed sale(s)`,
                409
              );
            }
          }

          event.tickets = stageData.tickets;
          event.stage = 3;
          break;
        }
        case 4:
          event.artistLineUp = stageData.artistLineUp || [];
          event.stage = 4;
          break;
        case 5:
          event.emergencyContact = stageData.emergencyContact;
          event.stage = 5;
          if (stageData.published !== undefined) {
            event.published = stageData.published;
          }
          break;
        default:
          throw this.businessError("Invalid stage number", 400);
      }

      await event.save();
      return event;
    } catch (error: any) {
      if (error.statusCode) throw error;
      throw new Error(`Error updating event stage: ${error.message}`);
    }
  }

  // Delete event
  async deleteEvent(id: string): Promise<void> {
    try {
      await this.ensureConnection();
      await eventModel.findByIdAndDelete(id);
    } catch (error: any) {
      throw new Error(`Error deleting event: ${error.message}`);
    }
  }

  // Publish event
  async publishEvent(id: string): Promise<IEvent | null> {
    try {
      await this.ensureConnection();

      const event = await eventModel.findById(id);
      if (!event) {
        throw new Error("Event not found");
      }

      // Validate event is complete (stage 5)
      if (event.stage < 5) {
        throw new Error("Event must be completed (stage 5) before publishing");
      }

      event.published = true;
      await event.save();
      return event;
    } catch (error: any) {
      throw new Error(`Error publishing event: ${error.message}`);
    }
  }

  // Unpublish event
  async unpublishEvent(id: string): Promise<IEvent | null> {
    try {
      await this.ensureConnection();

      return await eventModel.findByIdAndUpdate(
        id,
        { published: false },
        { new: true }
      );
    } catch (error: any) {
      throw new Error(`Error unpublishing event: ${error.message}`);
    }
  }

  // Get published events
  async getPublishedEvents(page: number = 1, limit: number = 10) {
    try {
      await this.ensureConnection();

      return await this.getAllEvents(page, limit, { published: true });
    } catch (error: any) {
      throw new Error(`Error fetching published events: ${error.message}`);
    }
  }

  // Search events
  async searchEvents(searchTerm: string) {
    try {
      await this.ensureConnection();

      return await eventModel.find({
        $or: [
          { "eventDetails.eventTitle": { $regex: searchTerm, $options: "i" } },
          { "eventDetails.eventTheme": { $regex: searchTerm, $options: "i" } },
          { "eventDetails.eventType": { $regex: searchTerm, $options: "i" } },
          { "eventDetails.venue": { $regex: searchTerm, $options: "i" } },
        ],
      }).sort({ createdAt: -1 });
    } catch (error: any) {
      throw new Error(`Error searching events: ${error.message}`);
    }
  }

  // Get upcoming events
  async getUpcomingEvents(page: number = 1, limit: number = 10) {
    try {
      await this.ensureConnection();
      const skip = (page - 1) * limit;
      const now = new Date();

      const events = await eventModel.find({
        published: true,
        "eventDetails.startDate": { $gte: now },
        "eventDetails.eventVisibility": true,
      })
        .sort({ "eventDetails.startDate": 1 })
        .skip(skip)
        .limit(limit);

      const total = await eventModel.countDocuments({
        published: true,
        "eventDetails.startDate": { $gte: now },
        "eventDetails.eventVisibility": true,
      });

      return {
        events,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      throw new Error(`Error fetching upcoming events: ${error.message}`);
    }
  }

  // Get past events
  async getPastEvents(page: number = 1, limit: number = 10) {
    try {
      await this.ensureConnection();
      const skip = (page - 1) * limit;
      const now = new Date();

      const events = await eventModel.find({
        published: true,
        "eventDetails.endDate": { $lt: now },
      })
        .sort({ "eventDetails.endDate": -1 })
        .skip(skip)
        .limit(limit);

      const total = await eventModel.countDocuments({
        published: true,
        "eventDetails.endDate": { $lt: now },
      });

      return {
        events,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      throw new Error(`Error fetching past events: ${error.message}`);
    }
  }

  // Get event statistics
  async getEventStats() {
    try {
      await this.ensureConnection();

      const total = await eventModel.countDocuments();
      const published = await eventModel.countDocuments({ published: true });
      const draft = await eventModel.countDocuments({ published: false });
      
      const now = new Date();
      const upcoming = await eventModel.countDocuments({
        published: true,
        "eventDetails.startDate": { $gte: now },
      });
      
      const past = await eventModel.countDocuments({
        published: true,
        "eventDetails.endDate": { $lt: now },
      });

      const byStage = await eventModel.aggregate([
        {
          $group: {
            _id: "$stage",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      return {
        total,
        published,
        draft,
        upcoming,
        past,
        byStage: byStage.map((item) => ({
          stage: item._id,
          count: item.count,
        })),
      };
    } catch (error: any) {
      throw new Error(`Error fetching event stats: ${error.message}`);
    }
  }

  /**
   * Count published events whose run overlaps the given window
   * (i.e. they were "active" at some point in that period).
   */
  async getActiveEventsCount(range: DashboardRange = "all") {
    try {
      await this.ensureConnection();
      const dateRange = getDashboardDateRange(range);

      const countActiveInWindow = async (window: DashboardDateRange["current"] | null) => {
        if (!window) return null;

        const query: any = {
          published: true,
          "eventDetails.startDate": { $lte: window.end },
        };

        if (window.start) {
          query["eventDetails.endDate"] = { $gte: window.start };
        }

        return eventModel.countDocuments(query);
      };

      const [current, previous] = await Promise.all([
        countActiveInWindow(dateRange.current),
        dateRange.previous ? countActiveInWindow(dateRange.previous) : Promise.resolve(null),
      ]);

      return this.withTrend(current as number, previous, "currentPeriod", "previousPeriod");
    } catch (error: any) {
      throw new Error(`Error fetching active events count: ${error.message}`);
    }
  }

  /**
   * Get average ticket price across published events created within
   * the given window, with trend vs. the equivalent prior window.
   */
  async getAverageTicketPriceStats(range: DashboardRange = "all") {
    try {
      await this.ensureConnection();
      const dateRange = getDashboardDateRange(range);

      const [current, previous] = await Promise.all([
        this.calculateAverageTicketPrice(dateRange.current),
        dateRange.previous
          ? this.calculateAverageTicketPrice(dateRange.previous)
          : Promise.resolve(null),
      ]);

      const trend = this.withTrend(current, previous, "currentPeriod", "previousPeriod");

      return {
        ...trend,
        currentPeriod: Number((trend.currentPeriod as number).toFixed(2)),
        previousPeriod:
          trend.previousPeriod === null ? null : Number((trend.previousPeriod as number).toFixed(2)),
        currency: "NGN", // Adjust based on your currency
      };
    } catch (error: any) {
      throw new Error(`Error fetching average ticket price stats: ${error.message}`);
    }
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
        trend: null,
      } as any;
    }

    const percentageChange =
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

    return {
      [currentKey]: current,
      [previousKey]: previous,
      percentageChange: Number(percentageChange.toFixed(2)),
      trend: percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable",
    } as any;
  }

  /**
   * Helper method to calculate average ticket price for a date window.
   * Only includes published events that hadn't ended before the window
   * started, created within the window.
   */
  private async calculateAverageTicketPrice(
    window: DashboardDateRange["current"]
  ): Promise<number> {
    const query: any = {
      published: true,
      createdAt: { $lte: window.end },
    };

    if (window.start) {
      query["eventDetails.endDate"] = { $gte: window.start };
      query.createdAt = { $gte: window.start, $lte: window.end };
    }

    const events = await eventModel.find(query).lean();

    if (events.length === 0) {
      return 0;
    }

    let totalPrice = 0;
    let ticketCount = 0;

    for (const event of events) {
      if (event.tickets && event.tickets.length > 0) {
        for (const ticket of event.tickets) {
          if (ticket.price && ticket.price > 0) {
            totalPrice += ticket.price;
            ticketCount++;
          }
        }
      }
    }

    return ticketCount > 0 ? totalPrice / ticketCount : 0;
  }

  /**
   * Get combined event dashboard stats
   */
  async getEventDashboardStats(range: DashboardRange = "all") {
    try {
      await this.ensureConnection();

      const [activeEventsStats, avgTicketPriceStats] = await Promise.all([
        this.getActiveEventsCount(range),
        this.getAverageTicketPriceStats(range),
      ]);

      return {
        range,
        activeEvents: activeEventsStats,
        averageTicketPrice: avgTicketPriceStats,
        generatedAt: new Date(),
      };
    } catch (error: any) {
      throw new Error(`Error fetching event dashboard stats: ${error.message}`);
    }
  }
}

export default new EventService();