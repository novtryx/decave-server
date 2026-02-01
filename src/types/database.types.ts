import mongoose, { Document, Mongoose } from "mongoose";

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
        _id:mongoose.Types.ObjectId

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
  qrCode: string;
}

export interface ITransactionHistory extends Document{
  txnId: string;
  paystackId:string;
  event: mongoose.Types.ObjectId;
  ticket: mongoose.Types.ObjectId;
  buyers: IBuyer[];
  status: "pending"| "failed"| "completed";
   createdAt?: Date;
  updatedAt?: Date;
}