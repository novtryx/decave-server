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
}

export default new EventService();