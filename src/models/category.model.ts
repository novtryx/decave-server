import mongoose, { Schema, Document } from "mongoose";

// A single question in a category's application form. Kept generic
// enough that ANY category's form is just an array of these — adding
// a 9th category later is a document insert, not new frontend code.
export interface ICategoryField {
  name: string; // machine key, used in Application.answers, e.g. "genre"
  label: string; // shown to the applicant, e.g. "Genre"
  type: "text" | "textarea" | "select" | "multiselect" | "file" | "url" | "number";
  required: boolean;
  options?: string[]; // for select / multiselect
  placeholder?: string;
  helpText?: string;
  order: number; // display order within the category form
}

export interface ICategory extends Document {
  slug: string; // used in /apply/:slug URLs, e.g. "artists"
  name: string; // display name, e.g. "Artists & Performers"
  description: string;
  active: boolean; // lets Afrospook close a category without deleting it
  fields: ICategoryField[];
  order: number; // display order on the category-selection grid
  createdAt: Date;
  updatedAt: Date;
}

const CategoryFieldSchema = new Schema<ICategoryField>(
  {
    name: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["text", "textarea", "select", "multiselect", "file", "url", "number"],
    },
    required: { type: Boolean, default: false },
    options: { type: [String], default: undefined },
    placeholder: { type: String, trim: true },
    helpText: { type: String, trim: true },
    order: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const CategorySchema = new Schema<ICategory>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true, index: true },
    fields: { type: [CategoryFieldSchema], default: [] },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Category =
  mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);

export default Category;