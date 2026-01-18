import mongoose, { Schema } from "mongoose";
import { IBuyer, ITransactionHistory } from "../types/database.types";

// Buyer Sub-Schema
const BuyerSchema = new Schema<IBuyer>(
  {
    fullName: { 
      type: String, 
      required: true, 
      trim: true 
    },
    email: { 
      type: String, 
      required: true, 
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
    },
    phoneNumber: { 
      type: String, 
      required: true, 
      trim: true 
    },
    ticketId: { 
      type: String, 
      required: true, 
      trim: true 
    },
    checkedIn: { 
      type: Boolean, 
      required: true, 
      default: false 
    },
    qrCode: { type: String },
  },
  { _id: true } // Each buyer gets their own _id
);

// Main Transaction History Schema
const TransactionHistorySchema = new Schema<ITransactionHistory>(
  {
    txnId: { 
      type: String, 
      required: true, 
      unique: true,
      trim: true,
      index: true
    },
    event: { 
      type: Schema.Types.ObjectId, 
      ref: "Event",
      required: true,
      index: true
    },
    paystackId: { 
      type: String, 
      required: true
    },
    ticket: { 
      type: Schema.Types.ObjectId, 
      required: true,
      index: true
    },
    buyers: { 
      type: [BuyerSchema], 
      required: true,
      validate: {
        validator: function(v: IBuyer[]) {
          return v.length > 0;
        },
        message: "At least one buyer is required"
      }
    },

    status: { 
      type: String, 
      required: true,
      enum: ["pending", "failed", "completed"],
      default: "pending",
      index: true
    },
  },
  { 
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
TransactionHistorySchema.index({ txnId: 1 });
TransactionHistorySchema.index({ event: 1, status: 1 });
TransactionHistorySchema.index({ status: 1, createdAt: -1 });
TransactionHistorySchema.index({ "buyers.email": 1 });

// Virtual to get total number of buyers
TransactionHistorySchema.virtual("totalBuyers").get(function () {
  return this.buyers.length;
});

// Virtual to get checked-in count
TransactionHistorySchema.virtual("checkedInCount").get(function () {
  return this.buyers.filter(buyer => buyer.checkedIn).length;
});

// Pre-save hook to ensure txnId is uppercase (if you want a specific format)
TransactionHistorySchema.pre("save", function () {
  if (this.isModified("txnId")) {
    this.txnId = this.txnId;
  }
});

export default mongoose.model<ITransactionHistory>(
  "TransactionHistory", 
  TransactionHistorySchema
);