import mongoose, { Document, Mongoose } from "mongoose";
import { Influencer } from './../models/influencer.model';

export interface IAdmin extends Document {
  fullName: string;
  brandName: string;
  email: string;
  supportEmail?: string;
  phone: string;
  password: string;
  twoFactorAuthEnabled: boolean;
  socialLinks: {
    facebook: string;
    twitter: string;
    instagram: string;
    tiktok: string;
  };
  address?: string;
  notificationPreferences: {
    orderConfirmation: boolean;
    eventReminder: boolean;
    marketingEmail: boolean;
    lowStockAlert: boolean;
    dailyReport: boolean;
    systemAlert: boolean;
  };
  otp?: string;
  otpExpiresAt?: Date;
  otpVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEvent extends Document {
    stage:number;
    published:boolean;
// stage 1
    eventDetails: {
        eventType: string;
        eventTitle: string;
        eventTheme: string;
        supportingText: string;
        eventBanner: string;
        startDate: Date;
        endDate: Date;
        venue:string;
        address?: string;
        brandColor: {
        primaryColor: string;
        secondaryColor: string;
        };
        eventVisibility: boolean;
    }
  // stage 2
  aboutEvent:{
        heading: string;
        description: string;
        content: {
            subTitle: string;
            sectionContent: string;
            supportingImage: string;
        }[];
  };

  //stage 3
  tickets:{
        ticketName: string;
        price: number;
        currency: string;
        initialQuantity:number;
        availableQuantity: number;
        benefits:string[];
        saleStartDate?: Date | null;
        saleEndDate?: Date | null;
        tierCategory?: string;
        _id:mongoose.Types.ObjectId

  }[];

  // Optional per-event cocktail/drink add-on menu, offered at checkout.
  // Always undiscounted here — the 20% off is applied at checkout time.
  cocktails?: {
        name: string;
        description?: string;
        price: number;
        currency: string;
        initialQuantity: number;
        availableQuantity: number;
        _id: mongoose.Types.ObjectId;
  }[];

  //stage 4
  artistLineUp:{
    artistImage: string;
    artistName: string;
    artistGenre: string;
    headliner:boolean;
    socials:{
        instgram: string;
        twitter:string;
        website:string;
    }[];
  }[];
  //stage 5
  faq:{
    question: string;
    answer: string;
  }[];
  code:{
    title: string;
    body: string;
  }[];
  emergencyContact:{
    security: string;
    medical: string;
    lostButFound:string;
    supportingInfo?: string;
  }
  createdAt?: Date;
  updatedAt?: Date;
}


export interface IPartner extends Document {
   partnerName: string;
  brandLogo: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  sponsorshipTier: string;
  associatedEvents: mongoose.Types.ObjectId[];
  partnershipStartDate: Date;
  partnershipEndDate: Date;
  internalNotes?: string;
  visibilityControl: {
    publicWebsite: boolean;
    partnershipPage: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IActivity extends Document {
    title: string;
    type: string;
    createdAt?: Date;

}

export interface ITransaction extends Document {
    transactionId: string;
    event: mongoose.Types.ObjectId;
    quantity: number;
    buyer:{
        
    }
}

export interface IBuyer extends Document {
  fullName: string;
  email: string;
  phoneNumber: string;
  ticketId: string;
  checkedIn: boolean;
  checkedInAt?: Date | null;
  checkedInBy?: mongoose.Types.ObjectId | null;
  qrCode: string;
}

export type TransactionStatus =
  | "pending"
  | "failed"
  | "completed"
  | "refunded"
  | "cancelled"
  | "manually_verified";

export interface ITransactionHistory extends Document{
  txnId: string;
  paystackId:string;
  event: mongoose.Types.ObjectId;
  ticket: mongoose.Types.ObjectId;
  buyers: IBuyer[];
  status: TransactionStatus;
  createdAt?: Date;
  updatedAt?: Date;
  influencer: any;
  // Payment channel the buyer paid through (card, bank_transfer, ussd,
  // manual, etc). Populated from Paystack's webhook payload where
  // available, or set explicitly on manual verification.
  paymentChannel?: string | null;
  // The full, undiscounted ticket price for this order — set at
  // checkout time. Used to calculate an influencer's commission off
  // the real ticket value even when a referral discount reduced what
  // the buyer actually paid, so the referral doesn't shrink their cut.
  originalAmount?: number;
  // Where the buyer came from — "influencer" is inferred from the
  // influencer field already; this captures organic sources like
  // instagram / whatsapp / direct / email / other.
  referralSource?: string | null;
  // Set once, the first time a pending transaction is flagged as
  // abandoned (still pending past the abandonment threshold). Lets the
  // recovery job avoid re-flagging/re-notifying the same transaction.
  abandonedAt?: Date | null;
  manualVerification?: {
    verifiedBy: mongoose.Types.ObjectId;
    verifiedAt: Date;
    note?: string;
  } | null;
  refund?: {
    amount: number;
    reason?: string;
    refundedBy: mongoose.Types.ObjectId;
    refundedAt: Date;
  } | null;
  cancellation?: {
    reason?: string;
    cancelledBy: mongoose.Types.ObjectId;
    cancelledAt: Date;
  } | null;
  // Optional cocktail/drink add-on order attached to this checkout.
  // Belongs to the primary buyer of the order, not per-attendee.
  // `unitPrice` is the full menu price; `discountedUnitPrice` is what
  // was actually charged (the fixed 20%-off checkout policy).
  // `redeemedQuantity` tracks partial redemption at the bar.
  cocktailOrder?: {
    items: {
      cocktail: mongoose.Types.ObjectId;
      name: string;
      unitPrice: number;
      discountedUnitPrice: number;
      quantity: number;
      redeemedQuantity: number;
    }[];
    totalAmount: number;
    qrCode?: string;
  } | null;
}