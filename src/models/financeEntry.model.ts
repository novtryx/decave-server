import mongoose, { Schema, Document } from "mongoose";

// A single manual money-in or money-out record. "Debit" = money
// spent (venue, sound, security, etc — money leaving you). "Credit"
// = money received outside of ticket sales (sponsorship, vendor fees,
// merch — money coming to you). Ticket revenue itself is NOT stored
// here; it's already tracked via TransactionHistory and gets pulled
// in live when building an event's finance summary, so there's no
// double-counting.

export type FinanceEntryType = "credit" | "debit";

export interface IFinanceEntry extends Document {
  // Optional — null means a general/company-wide entry not tied to
  // any single event (e.g. office rent, a retainer, admin software).
  event: mongoose.Types.ObjectId | null;
  type: FinanceEntryType;
  category: string;
  amount: number;
  currency: string;
  description: string;
  // When the money actually moved — defaults to now, but editable so
  // an admin can log something after the fact with the right date.
  date: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const FinanceEntrySchema = new Schema<IFinanceEntry>(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", default: null, index: true },
    type: { type: String, enum: ["credit", "debit"], required: true, index: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN" },
    description: { type: String, trim: true, default: "" },
    date: { type: Date, required: true, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "admin", required: true },
  },
  { timestamps: true }
);

FinanceEntrySchema.index({ event: 1, type: 1 });

export default mongoose.models.FinanceEntry ||
  mongoose.model<IFinanceEntry>("FinanceEntry", FinanceEntrySchema);