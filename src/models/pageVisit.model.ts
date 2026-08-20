import mongoose, { Schema, Document } from "mongoose";

// One row per event-page load. Deliberately lightweight — this is a
// traffic-source counter, not a full analytics/session table. Source
// resolution (utm_source vs Referer parsing) happens in the
// controller before this gets written, so `source` here is always
// already normalized to one of the known buckets.
export interface IPageVisit extends Document {
  event: mongoose.Types.ObjectId;
  source: string; // "instagram" | "whatsapp" | "twitter" | "facebook" | "tiktok" | "google" | "direct" | "other"
  medium: string | null; // raw utm_medium, if present (e.g. "story", "bio", "cpc")
  campaign: string | null; // raw utm_campaign, if present
  referrerHost: string | null; // raw Referer hostname, kept for debugging/auditing source resolution
  sessionRef: string; // client-generated id, lets a later purchase be tied back to this visit
  createdAt: Date;
}

const PageVisitSchema = new Schema<IPageVisit>(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: "direct",
      index: true,
    },
    medium: { type: String, default: null, trim: true },
    campaign: { type: String, default: null, trim: true },
    referrerHost: { type: String, default: null, trim: true },
    sessionRef: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Powers the "source breakdown per event" aggregation.
PageVisitSchema.index({ event: 1, source: 1 });
PageVisitSchema.index({ event: 1, createdAt: -1 });

const PageVisit =
  mongoose.models.PageVisit || mongoose.model<IPageVisit>("PageVisit", PageVisitSchema);

export default PageVisit;