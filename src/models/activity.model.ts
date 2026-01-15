import mongoose, { Schema } from "mongoose";
import { IActivity } from "../types/database.types";

const ActivitySchema = new Schema<IActivity>(
  {
    title: {
      type: String,
      required: [true, "Activity title is required"],
      trim: true,
      minlength: [3, "Activity title must be at least 3 characters"],
      maxlength: [200, "Activity title cannot exceed 200 characters"],
    },
    type: {
      type: String,
      required: [true, "Activity type is required"],
      trim: true,
      lowercase: true,
      enum: {
        values: [
          "event_created",
          "event_updated",
          "event_deleted",
          "event_published",
          "ticket_purchased",
          "ticket_cancelled",
          "partner_added",
          "partner_updated",
          "user_registered",
          "user_login",
          "payment_received",
          "payment_failed",
          "other"
        ],
        message: "{VALUE} is not a valid activity type",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
ActivitySchema.index({ type: 1 });
ActivitySchema.index({ createdAt: -1 }); // Most recent first
ActivitySchema.index({ type: 1, createdAt: -1 }); // Compound index for filtered sorting

// Virtual to get activity age in hours
ActivitySchema.virtual("ageInHours").get(function () {
  if (this.createdAt) {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    return diffHours;
  }
  return 0;
});

// Static method to find recent activities
ActivitySchema.statics.findRecent = function (limit: number = 10) {
  return this.find().sort({ createdAt: -1 }).limit(limit);
};

// Static method to find activities by type
ActivitySchema.statics.findByType = function (type: string) {
  return this.find({ type: type.toLowerCase() }).sort({ createdAt: -1 });
};

// Static method to find activities within date range
ActivitySchema.statics.findByDateRange = function (
  startDate: Date,
  endDate: Date
) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ createdAt: -1 });
};

export default mongoose.model<IActivity>("Activity", ActivitySchema);