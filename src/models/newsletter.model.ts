import { Schema, model, Document } from "mongoose";

export interface INewsletter extends Document {
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const newsletterSchema = new Schema<INewsletter>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
      index: true
    }
  },
  {
    timestamps: true
  }
);

export default model<INewsletter>("Newsletter", newsletterSchema);
