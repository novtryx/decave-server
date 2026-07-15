import mongoose, { Schema, Document } from "mongoose";

// Everything the CRM needs about *purchase history* (spend, events
// attended, check-ins) is derived live from TransactionHistory — no
// need to duplicate it here, and no risk of it going stale.
//
// This model only holds the bits that can't be derived: manually
// applied tags (e.g. "vendor", "press" — there's no ticket tier for
// those) and free-text notes an admin wants attached to a buyer.
// Keyed by lowercased email since that's the one stable identifier a
// buyer has across every transaction.

export interface ICustomerProfile extends Document {
  email: string;
  tags: string[];
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CustomerProfileSchema = new Schema<ICustomerProfile>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    tags: { type: [String], default: [] },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.CustomerProfile ||
  mongoose.model<ICustomerProfile>("CustomerProfile", CustomerProfileSchema);