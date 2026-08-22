import mongoose, { Schema, Document } from "mongoose";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "accepted"
  | "rejected";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "shortlisted",
  "accepted",
  "rejected",
];

// One value the applicant entered for a category field. Value is
// intentionally untyped at the schema level — its real shape (string,
// string[], or a file reference) is defined by the matching
// Category.fields[].type, resolved at read time, not enforced by
// Mongoose. This is what lets one Application schema serve 8 very
// different question sets without 8 different collections.
export interface IApplicationAnswer {
  fieldName: string; // matches ICategoryField.name
  value: any;
}

export interface IUploadedFile {
  fieldName: string; // which category field this file answers
  url: string;
  publicId: string;
  originalName: string;
  format?: string;
  resourceType: "image" | "video" | "raw";
}

export interface IApplication extends Document {
  applicant: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  status: ApplicationStatus;
  answers: IApplicationAnswer[];
  files: IUploadedFile[];
  resumeToken: string; // private link token, like a Google Form edit link
  submittedAt: Date | null;
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationAnswerSchema = new Schema<IApplicationAnswer>(
  {
    fieldName: { type: String, required: true, trim: true },
    value: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const UploadedFileSchema = new Schema<IUploadedFile>(
  {
    fieldName: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    originalName: { type: String, required: true },
    format: { type: String },
    resourceType: { type: String, enum: ["image", "video", "raw"], required: true },
  },
  { _id: false }
);

const ApplicationSchema = new Schema<IApplication>(
  {
    applicant: {
      type: Schema.Types.ObjectId,
      ref: "Applicant",
      required: true,
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "draft",
      index: true,
    },
    answers: { type: [ApplicationAnswerSchema], default: [] },
    files: { type: [UploadedFileSchema], default: [] },
    resumeToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "admin", default: null },
    reviewNote: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

// One applicant can eventually have multiple applications (spec
// section 23), but never two for the SAME category — prevents
// accidental duplicate submissions to "Artists & Performers" while
// still allowing "Artists & Performers" + "Creators" from one person.
ApplicationSchema.index({ applicant: 1, category: 1 }, { unique: true });
ApplicationSchema.index({ category: 1, status: 1 });
ApplicationSchema.index({ status: 1, createdAt: -1 });

const Application =
  mongoose.models.Application || mongoose.model<IApplication>("Application", ApplicationSchema);

export default Application;