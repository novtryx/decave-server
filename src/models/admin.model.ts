import mongoose, { Schema } from "mongoose";
import { IAdmin } from "../types/database.types";



const AdminSchema = new Schema<IAdmin>(
  {
    fullName: { type: String, required: true },
    brandName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    supportEmail:{type: String},
    phone: { type: String, required: true },
    password: { type: String, required: true },
    twoFactorAuthEnabled: { type: Boolean, default: false },
    socialLinks: {
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
      instagram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
    },
    address: { type: String, default: "" },
    notificationPreferences: {
      orderConfirmation: { type: Boolean, default: false },
      eventReminder: { type: Boolean, default: false },
      marketingEmail: { type: Boolean, default: false },
      lowStockAlert: { type: Boolean, default: false },
      dailyReport: { type: Boolean, default: false },
      systemAlert: { type: Boolean, default: false },
    },
    otp: { type: String },
    otpExpiresAt: { type: Date },
    otpVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IAdmin>("admin", AdminSchema);

