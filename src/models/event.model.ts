import mongoose, { Schema } from "mongoose";
import { IEvent } from "../types/database.types";

const BrandColorSchema = new Schema(
  {
    primaryColor: { type: String, required: true, trim: true, default: "#CCA33A"},
    secondaryColor: { type: String, required: true, trim: true, default: "#001D3D" },
  },
  { _id: false }
);

const EventDetailsSchema = new Schema(
  {
    eventType: { type: String, required: true, trim: true },
    eventTitle: { type: String, required: true, trim: true },
    eventTheme: { type: String, required: true, trim: true },
    supportingText: { type: String, required: true, trim: true },
    eventBanner: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    venue: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    brandColor: { type: BrandColorSchema, required: true },
    eventVisibility: { type: Boolean, default: true },
  },
  { _id: false }
);

const ContentSectionSchema = new Schema(
  {
    subTitle: { type: String, required: true, trim: true },
    sectionContent: { type: String, required: true, trim: true },
    supportingImage: { type: String, required: true },
  },
  { _id: false }
);

const AboutEventSchema = new Schema(
  {
    heading: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    content: { type: [ContentSectionSchema], default: [] },
  },
  { _id: false }
);

const TicketSchema = new Schema(
  {
    ticketName: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, default: "NGN" },
    initialQuantity: { type: Number, required: true, min: 0 },
    availableQuantity: { type: Number, required: true, min: 0 },
    benefits: { type: [String], default: [] },
  },
  { _id: true }
);

const SocialsSchema = new Schema(
  {
    instagram: { type: String, trim: true, default: "" },
    twitter: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const ArtistLineUpSchema = new Schema(
  {
    artistImage: { type: String, required: true },
    artistName: { type: String, required: true, trim: true },
    artistGenre: { type: String, required: true, trim: true },
    headliner: { type: Boolean, default: false },
    socials: { type: SocialsSchema, required: true },
  },
  { _id: true }
);

const EmergencyContactSchema = new Schema(
  {
    security: { type: String, required: true, trim: true },
    medical: { type: String, required: true, trim: true },
    lostButFound: { type: String, required: true, trim: true },
    supportingInfo: { type: String, trim: true },
  },
  { _id: false }
);

const faqSchema = new Schema(
  {
    question:{type: String, required: true, trim: true},
    answer:{type: String, required: true, trim: true}
  },
  {_id: true}
);

const codeSchema = new Schema(
  {
    title:{type: String, required: true, trim: true},
    body:{type: String, required: true, trim: true}
  },
  {_id: true}
);
// Main Event Schema
const EventSchema = new Schema<IEvent>(
  {
    stage: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 5, 
      default: 1 
    },
    published:{ type: Boolean, required: true, default: false},
    eventDetails: { 
      type: EventDetailsSchema, 
      required: true 
    },
    aboutEvent: { 
      type: AboutEventSchema, 
      required: false 
    },
    tickets: { 
      type: [TicketSchema], 
      default: [] 
    },
    artistLineUp: { 
      type: [ArtistLineUpSchema], 
      default: [] 
    },
    emergencyContact: { 
      type: EmergencyContactSchema, 
      required: false 
    },
    faq:{
      type: [faqSchema],
      default: []
    },
    code:{
      type:[codeSchema],
      default: []
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
EventSchema.index({ "eventDetails.startDate": 1 });
EventSchema.index({ "eventDetails.endDate": 1 });
EventSchema.index({ "eventDetails.eventVisibility": 1 });
EventSchema.index({ stage: 1 });

// Virtual for checking if event is active
EventSchema.virtual("isEventActive").get(function () {
  const now = new Date();
  return (
    this.eventDetails.startDate <= now &&
    this.eventDetails.endDate >= now &&
    this.eventDetails.eventVisibility
  );
});

// Custom validation: endDate must be after startDate
EventSchema.path("eventDetails").validate(function (value: any) {
  if (value.startDate && value.endDate) {
    return value.endDate > value.startDate;
  }
  return true;
}, "End date must be after start date");

// Pre-save hook to ensure availableQuantity doesn't exceed initialQuantity
EventSchema.pre("save", function () {
  if (this.tickets && this.tickets.length > 0) {
    this.tickets.forEach((ticket: any) => {
      if (ticket.availableQuantity > ticket.initialQuantity) {
        ticket.availableQuantity = ticket.initialQuantity;
      }
    });
  }
});

export default mongoose.model<IEvent>("Event", EventSchema);