// bank-account.schema.ts
import { Schema } from 'mongoose';

export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountName?: string;
  bankCode?: string;
  verified: boolean;
}

export const BankAccountSchema = new Schema<BankAccount>(
  {
    bankName: { type: String, required: true, trim: true },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 10,
    },
    // From Paystack account resolution
    accountName: { type: String, trim: true },
    bankCode: { type: String, trim: true },
    verified: { type: Boolean, default: false },
  },
  { _id: false }
);