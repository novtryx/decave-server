import eventModel from "../models/event.model";
import { IEvent } from "../types/database.types";
import { connectDB } from "../config/database";

export class EventService {
  private async ensureConnection() {
    await connectDB();
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
  async updateEvent(id: string, updateData: Partial<IEvent>): Promise<IEvent | null> {
    try {
      await this.ensureConnection();

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
      throw new Error(`Error updating event: ${error.message}`);
    }
  }


async updateEventTicket(
  eventId: string,
  ticketId: string,
  updateData: Partial<{
    ticketName: string;
    price: number; // allowed in payload, but ignored
    currency: string;
    availableQuantity: number;
    benefits: string[];
  }>
): Promise<IEvent | null> {
  try {
    await this.ensureConnection();

    const event = await eventModel.findById(eventId);
    if (!event) throw new Error("Event not found");

    const ticket = event.tickets.find(
      (t: any) => t._id.toString() === ticketId
    );
    if (!ticket) throw new Error("Ticket not found");

    // =========================
    // Update Basic Fields
    // =========================
    if (updateData.ticketName !== undefined)
      ticket.ticketName = updateData.ticketName;

    // ✅ Ignore price updates completely
    // if (updateData.price !== undefined) { ... } <- removed

    if (updateData.currency !== undefined)
      ticket.currency = updateData.currency;

    if (updateData.benefits !== undefined)
      ticket.benefits = updateData.benefits;

    // =========================
    // 🔥 Advanced Quantity Logic
    // =========================
    if (updateData.availableQuantity !== undefined) {
      const newAvailable = updateData.availableQuantity;
      const currentAvailable = ticket.availableQuantity;
      const currentInitial = ticket.initialQuantity;

      if (newAvailable < 0) {
        throw new Error("Available quantity cannot be negative");
      }

      // CASE 1: Set available to 0
      if (newAvailable === 0) {
        ticket.initialQuantity = currentInitial - currentAvailable;
        ticket.availableQuantity = 0;
      }
      // CASE 2: Increase available (restock)
      else if (newAvailable > currentAvailable) {
        const difference = newAvailable - currentAvailable;
        ticket.initialQuantity = currentInitial + difference;
        ticket.availableQuantity = newAvailable;
      }
      // CASE 3: Decrease available normally
      else {
        ticket.availableQuantity = newAvailable;
      }
    }

    await event.save();
    return event;

  } catch (error: any) {
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
  }
): Promise<IEvent | null> {
  try {
    await this.ensureConnection();

    const event = await eventModel.findById(eventId);
    if (!event) throw new Error("Event not found");

    event.tickets.push({
      ticketName: data.ticketName,
      price: data.price,
      currency: data.currency ?? "NGN",
      initialQuantity: data.initialQuantity,
      availableQuantity: data.initialQuantity,
      benefits: data.benefits ?? [],
    } as any);

    await event.save();
    return event;

  } catch (error: any) {
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
        throw new Error("Event not found");
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
        case 3:
          event.tickets = stageData.tickets;
          event.stage = 3;
          break;
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
          throw new Error("Invalid stage number");
      }

      await event.save();
      return event;
    } catch (error: any) {
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

  async getActiveEventsCount() {
    try {
      await this.ensureConnection();
      const now = new Date();

      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      // Current month active events (published and not ended)
      const currentMonthActive = await eventModel.countDocuments({
        published: true,
        "eventDetails.endDate": { $gte: currentMonthStart }
      });

      // Last month active events
      const lastMonthActive = await eventModel.countDocuments({
        published: true,
        "eventDetails.endDate": { $gte: lastMonthStart },
        createdAt: { $lte: lastMonthEnd }
      });

      // Calculate percentage change
      let percentageChange = 0;
      if (lastMonthActive > 0) {
        percentageChange = ((currentMonthActive - lastMonthActive) / lastMonthActive) * 100;
      } else if (currentMonthActive > 0) {
        percentageChange = 100;
      }

      return {
        currentMonth: currentMonthActive,
        lastMonth: lastMonthActive,
        percentageChange: parseFloat(percentageChange.toFixed(2)),
        trend: percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable"
      };
    } catch (error: any) {
      throw new Error(`Error fetching active events count: ${error.message}`);
    }
  }

  /**
   * Get average ticket price with percentage change compared to last month
   * Only includes published, active events
   */
  async getAverageTicketPriceStats() {
    try {
      await this.ensureConnection();

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      // Get current month average
      const currentMonthAvg = await this.calculateAverageTicketPrice(
        currentMonthStart,
        now
      );

      // Get last month average
      const lastMonthAvg = await this.calculateAverageTicketPrice(
        lastMonthStart,
        lastMonthEnd
      );

      // Calculate percentage change
      let percentageChange = 0;
      if (lastMonthAvg > 0) {
        percentageChange = ((currentMonthAvg - lastMonthAvg) / lastMonthAvg) * 100;
      } else if (currentMonthAvg > 0) {
        percentageChange = 100;
      }

      return {
        currentMonth: parseFloat(currentMonthAvg.toFixed(2)),
        lastMonth: parseFloat(lastMonthAvg.toFixed(2)),
        percentageChange: parseFloat(percentageChange.toFixed(2)),
        trend: percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable",
        currency: "NGN" // Adjust based on your currency
      };
    } catch (error: any) {
      throw new Error(`Error fetching average ticket price stats: ${error.message}`);
    }
  }

  /**
   * Helper method to calculate average ticket price for a date range
   * Only includes published events that are not past events
   */
  private async calculateAverageTicketPrice(
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const events = await eventModel.find({
      published: true,
      "eventDetails.endDate": { $gte: startDate },
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).lean();

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
  async getEventDashboardStats() {
    try {
      await this.ensureConnection();

      const [activeEventsStats, avgTicketPriceStats] = await Promise.all([
        this.getActiveEventsCount(),
        this.getAverageTicketPriceStats()
      ]);

      return {
        activeEvents: activeEventsStats,
        averageTicketPrice: avgTicketPriceStats,
        generatedAt: new Date()
      };
    } catch (error: any) {
      throw new Error(`Error fetching event dashboard stats: ${error.message}`);
    }
  }
}

export default new EventService();