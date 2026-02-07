import mongoose, { Schema } from "mongoose";
import { IBuyer, ITransactionHistory } from "../types/database.types";

// Buyer Sub-Schema
const BuyerSchema = new Schema<IBuyer>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    ticketId: {
      type: String,
      required: true,
      trim: true,
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    qrCode: {
      type: String,
    },
  },
  { _id: true }
);

// Main Transaction History Schema
const TransactionHistorySchema = new Schema<ITransactionHistory>(
  {
    txnId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // index: true, 
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    paystackId: {
      type: String,
      required: true,
    },
    ticket: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    buyers: {
      type: [BuyerSchema],
      required: true,
      validate: {
        validator: (v: IBuyer[]) => v.length > 0,
        message: "At least one buyer is required",
      },
    },
   
    status: {
      type: String,
      enum: ["pending", "failed", "completed"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
TransactionHistorySchema.index({ txnId: 1 });
TransactionHistorySchema.index({ event: 1, status: 1 });
TransactionHistorySchema.index({ status: 1, createdAt: -1 });
TransactionHistorySchema.index({ "buyers.email": 1 });

// Virtuals
// TransactionHistorySchema.virtual("totalBuyers").get(function () {
//   return this.buyers.length;
// });

TransactionHistorySchema.virtual("checkedInCount").get(function () {
  return this.buyers.filter(b => b.checkedIn).length;
});


// ✅ NEXT.JS SAFE EXPORT (IMPORTANT)
const TransactionHistory =
  mongoose.models.TransactionHistory ||
  mongoose.model<ITransactionHistory>(
    "TransactionHistory",
    TransactionHistorySchema
  );

export default TransactionHistory;
