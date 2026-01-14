
import activityModel from "../models/activity.model";
import { IActivity } from "../types/database.types";

// Activity type enum for type safety
export enum ActivityType {
  EVENT_CREATED = "event_created",
  EVENT_UPDATED = "event_updated",
  EVENT_DELETED = "event_deleted",
  TICKET_PURCHASED = "ticket_purchased",
  TICKET_CANCELLED = "ticket_cancelled",
  PARTNER_ADDED = "partner_added",
  PARTNER_UPDATED = "partner_updated",
  USER_REGISTERED = "user_registered",
  USER_LOGIN = "user_login",
  PAYMENT_RECEIVED = "payment_received",
  PAYMENT_FAILED = "payment_failed",
  OTHER = "other",
}

export class ActivityService {
  // Create a new activity
  async createActivity(title: string, type: ActivityType | string): Promise<IActivity> {
    try {
      const activity = new activityModel({
        title,
        type: type.toLowerCase(),
      });

      await activity.save();
      return activity;
    } catch (error: any) {
      throw new Error(`Error creating activity: ${error.message}`);
    }
  }

  // Get activity by ID
  async getActivityById(id: string): Promise<IActivity | null> {
    try {
      return await activityModel.findById(id);
    } catch (error: any) {
      throw new Error(`Error fetching activity: ${error.message}`);
    }
  }

  // Get all activities with pagination
  async getAllActivities(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const activities = await activityModel.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await activityModel.countDocuments();

      return {
        activities,
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
      throw new Error(`Error fetching activities: ${error.message}`);
    }
  }

 

  // Get activities by type with pagination
  async getActivitiesByTypeWithPagination(
    type: ActivityType | string,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      const skip = (page - 1) * limit;

      const activities = await activityModel.find({ type: type.toLowerCase() })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await activityModel.countDocuments({ type: type.toLowerCase() });

      return {
        activities,
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
      throw new Error(`Error fetching activities by type: ${error.message}`);
    }
  }

 




 

 

  // Search activities by title
  async searchActivities(searchTerm: string): Promise<IActivity[]> {
    try {
      return await activityModel.find({
        title: { $regex: searchTerm, $options: "i" },
      }).sort({ createdAt: -1 });
    } catch (error: any) {
      throw new Error(`Error searching activities: ${error.message}`);
    }
  }

  
  // Get activity count by type
  async getCountByType(type: ActivityType | string): Promise<number> {
    try {
      return await activityModel.countDocuments({ type: type.toLowerCase() });
    } catch (error: any) {
      throw new Error(`Error counting activities by type: ${error.message}`);
    }
  }

  // Delete activity by ID
  async deleteActivity(id: string): Promise<void> {
    try {
      await activityModel.findByIdAndDelete(id);
    } catch (error: any) {
      throw new Error(`Error deleting activity: ${error.message}`);
    }
  }

  // Delete activities older than specified days
  async deleteOldActivities(daysOld: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await activityModel.deleteMany({
        createdAt: { $lt: cutoffDate },
      });

      return result.deletedCount || 0;
    } catch (error: any) {
      throw new Error(`Error deleting old activities: ${error.message}`);
    }
  }

  // Delete all activities (use with caution)
  async deleteAllActivities(): Promise<number> {
    try {
      const result = await activityModel.deleteMany({});
      return result.deletedCount || 0;
    } catch (error: any) {
      throw new Error(`Error deleting all activities: ${error.message}`);
    }
  }

  // Update activity
  async updateActivity(id: string, title: string): Promise<IActivity | null> {
    try {
      return await activityModel.findByIdAndUpdate(
        id,
        { title },
        { new: true, runValidators: true }
      );
    } catch (error: any) {
      throw new Error(`Error updating activity: ${error.message}`);
    }
  }

  // Bulk create activities
  async bulkCreateActivities(activities: Array<{ title: string; type: ActivityType | string }>): Promise<IActivity[]> {
    try {
      const activityDocs = activities.map((activity) => ({
        title: activity.title,
        type: activity.type.toLowerCase(),
      }));

      return await activityModel.insertMany(activityDocs);
    } catch (error: any) {
      throw new Error(`Error bulk creating activities: ${error.message}`);
    }
  }

  // Get activities grouped by date
  async getActivitiesGroupedByDate(startDate: Date, endDate: Date) {
    try {
      const activities = await activityModel.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
            activities: { $push: "$$ROOT" },
          },
        },
        {
          $sort: { _id: -1 },
        },
      ]);

      return activities.map((item) => ({
        date: item._id,
        count: item.count,
        activities: item.activities,
      }));
    } catch (error: any) {
      throw new Error(`Error grouping activities by date: ${error.message}`);
    }
  }
}

export default new ActivityService();