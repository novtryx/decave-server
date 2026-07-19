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
    // Who checked this buyer in and when — powers the duplicate-scan
    // warning ("already checked in by X at Y") and door-metrics'
    // peak entry time. Both null until the first successful check-in.
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: Schema.Types.ObjectId, ref: "admin", default: null },
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
    influencer: {
    type: Schema.Types.ObjectId,
    ref: "Influencer",
    default: null,
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
      enum: ["pending", "failed", "completed", "refunded", "cancelled", "manually_verified"],
      default: "pending",
      index: true,
    },
    paymentChannel: { type: String, default: null, trim: true },
    originalAmount: { type: Number, default: null },
    referralSource: { type: String, default: null, trim: true },
    abandonedAt: { type: Date, default: null },
    manualVerification: {
      type: new Schema(
        {
          verifiedBy: { type: Schema.Types.ObjectId, ref: "admin", required: true },
          verifiedAt: { type: Date, required: true, default: Date.now },
          note: { type: String, trim: true },
        },
        { _id: false }
      ),
      default: null,
    },
    refund: {
      type: new Schema(
        {
          amount: { type: Number, required: true, min: 0 },
          reason: { type: String, trim: true },
          refundedBy: { type: Schema.Types.ObjectId, ref: "admin", required: true },
          refundedAt: { type: Date, required: true, default: Date.now },
        },
        { _id: false }
      ),
      default: null,
    },
    cancellation: {
      type: new Schema(
        {
          reason: { type: String, trim: true },
          cancelledBy: { type: Schema.Types.ObjectId, ref: "admin", required: true },
          cancelledAt: { type: Date, required: true, default: Date.now },
        },
        { _id: false }
      ),
      default: null,
    },

    // Optional cocktail/drink add-on order for this checkout. Belongs
    // to the primary buyer, not per-attendee.
    cocktailOrder: {
      type: new Schema(
        {
          items: {
            type: [
              new Schema(
                {
                  cocktail: { type: Schema.Types.ObjectId, required: true },
                  name: { type: String, required: true, trim: true },
                  unitPrice: { type: Number, required: true, min: 0 },
                  discountedUnitPrice: { type: Number, required: true, min: 0 },
                  quantity: { type: Number, required: true, min: 1 },
                  redeemedQuantity: { type: Number, required: true, default: 0, min: 0 },
                },
                { _id: false }
              ),
            ],
            default: [],
          },
          totalAmount: { type: Number, required: true, min: 0 },
          qrCode: { type: String, default: "" },
        },
        { _id: false }
      ),
      default: null,
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