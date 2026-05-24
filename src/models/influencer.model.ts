// influencer.schema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';
import { BankAccount, BankAccountSchema } from './bank-account.model';

export interface Influencer {
  fullName: string;
  email: string;
  username: string;
  password: string;
  bankAccount?: BankAccount | null;
  referralCode: string;
  buyers: number;
  amount: number;
  resetToken?: string | null;
  resetTokenExpiry?: Date | null;
  influencersTakesPercentage: boolean;
  percentage: number;
}

export type InfluencerDocument = Influencer & Document;

const InfluencerSchema = new Schema<InfluencerDocument>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true },
    bankAccount: {
      type: BankAccountSchema,
      required: false,
      default: null,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    // Total number of buyers referred
    buyers: { type: Number, default: 0 },
    // Wallet balance / earnings
    amount: { type: Number, default: 0 },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    influencersTakesPercentage: { type: Boolean, default: true },
    percentage: { type: Number, default: 10, min: 0, max: 100 },
  },
  { timestamps: true }
);

export const InfluencerModel = mongoose.model<InfluencerDocument>(
  'Influencer',
  InfluencerSchema
);