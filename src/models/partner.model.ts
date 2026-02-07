import mongoose, { Schema, Document } from "mongoose";
import { IPartner } from "../types/database.types";


const VisibilityControlSchema = new Schema(
  {
    publicWebsite: { type: Boolean, default: true },
    partnershipPage: { type: Boolean, default: true },
  },
  { _id: false }
);

// Main Partner Schema
const PartnerSchema = new Schema<IPartner>(
  {
    partnerName: { 
      type: String, 
      required: [true, "Partner name is required"],
      trim: true,
      minlength: [2, "Partner name must be at least 2 characters"],
      maxlength: [200, "Partner name cannot exceed 200 characters"]
    },
    brandLogo: { 
      type: String, 
      required: [true, "Brand logo is required"]
    },
    contactPerson: { 
      type: String, 
      required: [true, "Contact person is required"],
      trim: true,
      minlength: [2, "Contact person name must be at least 2 characters"]
    },
    contactEmail: { 
      type: String, 
      required: [true, "Contact email is required"],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address"
      ]
    },
    contactPhone: { 
      type: String, 
      required: [true, "Contact phone is required"],
      trim: true
    },
    sponsorshipTier: { 
      type: String, 
      required: [true, "Sponsorship tier is required"],
      enum: {
        values: ["platinum", "gold", "silver", "bronze", "partner"],
        message: "{VALUE} is not a valid sponsorship tier"
      },
      lowercase: true
    },
    associatedEvents: [{ 
      type: Schema.Types.ObjectId, 
      ref: "Event",
      // index: true
    }],
    partnershipStartDate: { 
      type: Date, 
      required: [true, "Partnership start date is required"]
    },
    partnershipEndDate: { 
      type: Date, 
      required: [true, "Partnership end date is required"]
    },
    internalNotes: { 
      type: String, 
      trim: true,
      maxlength: [1000, "Internal notes cannot exceed 1000 characters"]
    },
    visibilityControl: { 
      type: VisibilityControlSchema, 
      required: true,
      default: () => ({
        publicWebsite: true,
        partnershipPage: true
      })
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
PartnerSchema.index({ partnerName: 1 });
PartnerSchema.index({ contactEmail: 1 });
PartnerSchema.index({ sponsorshipTier: 1 });
PartnerSchema.index({ partnershipStartDate: 1, partnershipEndDate: 1 });
PartnerSchema.index({ "associatedEvents": 1 });

// Compound index for active partnerships
PartnerSchema.index({ 
  partnershipStartDate: 1, 
  partnershipEndDate: 1, 
  sponsorshipTier: 1 
});

// Virtual for checking if partnership is currently active
PartnerSchema.virtual("isActive").get(function () {
  const now = new Date();
  return (
    this.partnershipStartDate <= now &&
    this.partnershipEndDate >= now
  );
});

// Virtual for partnership duration in days
PartnerSchema.virtual("partnershipDuration").get(function () {
  if (this.partnershipStartDate && this.partnershipEndDate) {
    const diffTime = Math.abs(this.partnershipEndDate.getTime() - this.partnershipStartDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Virtual for days remaining in partnership
PartnerSchema.virtual("daysRemaining").get(function () {
  const now = new Date();
  if (this.partnershipEndDate > now) {
    const diffTime = this.partnershipEndDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Custom validation: endDate must be after startDate
PartnerSchema.path("partnershipEndDate").validate(function (value: Date) {
  return value > this.partnershipStartDate;
}, "Partnership end date must be after start date");

// Pre-save validation hook
PartnerSchema.pre("save", function () {
  // Ensure partnership dates are valid
  if (this.partnershipStartDate && this.partnershipEndDate) {
    if (this.partnershipEndDate <= this.partnershipStartDate) {
      throw new Error("Partnership end date must be after start date");
    }
  }
  
  // Ensure contact email is lowercase
  if (this.contactEmail) {
    this.contactEmail = this.contactEmail.toLowerCase().trim();
  }
});

// Instance method to check if partnership will expire soon (within 30 days)
PartnerSchema.methods.isExpiringSoon = function (): boolean {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  return (
    this.partnershipEndDate <= thirtyDaysFromNow &&
    this.partnershipEndDate >= new Date()
  );
};

// Static method to find active partners
PartnerSchema.statics.findActivePartners = function () {
  const now = new Date();
  return this.find({
    partnershipStartDate: { $lte: now },
    partnershipEndDate: { $gte: now }
  });
};

// Static method to find partners by tier
PartnerSchema.statics.findByTier = function (tier: string) {
  return this.find({ sponsorshipTier: tier.toLowerCase() });
};

export default mongoose.model<IPartner>("Partner", PartnerSchema);