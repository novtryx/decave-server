import mongoose, { Schema, Document } from "mongoose";

// Deliberately has no password/auth fields — per the open-call spec,
// applicants never create an account. Identity is just "the person
// with this email", deduped so someone applying to a second category
// later reuses the same Applicant record instead of creating a
// duplicate (spec section 23: one account, many applications).
export interface IApplicant extends Document {
  fullName: string;
  email: string;
  phoneNumber: string;
  country?: string;
  city?: string;
  profilePhoto?: string; // Cloudinary URL
  socialHandles?: {
    instagram?: string;
    tiktok?: string;
    twitter?: string;
    website?: string;
  };
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicantSchema = new Schema<IApplicant>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
      index: true,
    },
    phoneNumber: { type: String, required: true, trim: true },
    country: { type: String, trim: true },
    city: { type: String, trim: true },
    profilePhoto: { type: String, default: null },
    socialHandles: {
      instagram: { type: String, trim: true },
      tiktok: { type: String, trim: true },
      twitter: { type: String, trim: true },
      website: { type: String, trim: true },
    },
    bio: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

const Applicant =
  mongoose.models.Applicant || mongoose.model<IApplicant>("Applicant", ApplicantSchema);

export default Applicant;