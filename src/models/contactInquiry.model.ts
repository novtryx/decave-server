import mongoose, { Schema, Document } from "mongoose";

export type InquiryType = "Media Inquiries" | "Sponsorship & Partnerships" | "Ticket Support" | "General";

export const INQUIRY_TYPES: InquiryType[] = [
  "Media Inquiries",
  "Sponsorship & Partnerships",
  "Ticket Support",
  "General",
];

export interface IContactInquiry extends Document {
  fullName: string;
  email: string;
  phoneNumber: string;
  inquiryType: InquiryType;
  message: string;
  status: "new" | "responded" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const ContactInquirySchema = new Schema<IContactInquiry>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phoneNumber: { type: String, required: true, trim: true },
    inquiryType: {
      type: String,
      enum: INQUIRY_TYPES,
      required: true,
    },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    // Lightweight status so a future admin inbox has somewhere to
    // start — not exposed anywhere yet, just not worth adding later
    // as a migration once real inquiries already exist.
    status: { type: String, enum: ["new", "responded", "archived"], default: "new" },
  },
  { timestamps: true }
);

ContactInquirySchema.index({ createdAt: -1 });
ContactInquirySchema.index({ status: 1 });

const ContactInquiry =
  mongoose.models.ContactInquiry || mongoose.model<IContactInquiry>("ContactInquiry", ContactInquirySchema);

export default ContactInquiry;