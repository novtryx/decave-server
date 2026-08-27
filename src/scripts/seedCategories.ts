/**
 * One-time seed for the 6 Afrospook 2026 Open Call categories.
 * Run with: npx ts-node src/scripts/seedCategories.ts
 *
 * Safe to re-run — upserts by slug, so it won't create duplicates if
 * a category was already seeded, and re-running after editing a
 * category's fields here will push those edits live.
 *
 * v2 changes (client-requested simplification):
 * - Vendors & Exhibitors now also covers Food & Drink (separate
 *   "food-drink" category removed/merged in).
 * - Experience Partners merged into Brands & Partners as
 *   "Brands & Experience Partners".
 * - Field lists drastically trimmed to match the simplified forms.
 * - Full Name, Email Address and Phone/WhatsApp Number are NOT
 *   listed here — the frontend (app/apply/page.tsx) already collects
 *   those once, up front, as core `applicant` fields on every
 *   category (see startOpenCallApplication). Category `fields` only
 *   covers the extra, category-specific questions. The "phone number"
 *   the client asked to change to "WhatsApp number" is that same core
 *   applicant field, so it's a frontend label/copy change, not a
 *   field added here.
 * - Every category now ends with the "How did you hear about the
 *   AfroSpook Open Call?" field.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Category, { ICategoryField } from "../models/category.model";

dotenv.config();

type SeedCategory = {
  slug: string;
  name: string;
  description: string;
  order: number;
  fields: Omit<ICategoryField, "order">[];
};

// order is auto-assigned from array position within each category —
// keeps this list readable without hand-numbering every field.
const withOrder = (fields: Omit<ICategoryField, "order">[]): ICategoryField[] =>
  fields.map((f, i) => ({ ...f, order: i }));

// Shared by every category — appended as the last field for each one.
const HOW_HEARD_FIELD: Omit<ICategoryField, "order"> = {
  name: "howHeard",
  label: "How did you hear about the AfroSpook Open Call?",
  type: "select",
  required: true,
  options: ["Instagram", "WhatsApp", "TikTok", "X / Twitter", "Friend / Referral", "Other"],
};

const CATEGORIES: SeedCategory[] = [
  {
    slug: "artists",
    name: "Artists & Performers",
    description: "Musicians, DJs, dancers, spoken word artists, live performers and cultural performers.",
    order: 1,
    fields: [
      { name: "stageName", label: "Stage Name", type: "text", required: false },
      { name: "performanceType", label: "What do you do?", type: "select", required: true, options: ["Singer", "Rapper", "DJ", "Dancer", "Band", "Other"] },
      { name: "socialHandle", label: "Instagram / Social Media Handle", type: "text", required: true },
      { name: "workLink", label: "Link to your work", type: "url", required: false },
      HOW_HEARD_FIELD,
    ],
  },
  {
    slug: "creators",
    name: "Creators",
    description: "Photographers, videographers, UGC creators, social media creators and storytellers.",
    order: 2,
    fields: [
      { name: "contentType", label: "What kind of content do you create?", type: "text", required: true },
      { name: "socialHandle", label: "Instagram / TikTok / Social Media Handle", type: "text", required: true },
      { name: "workLink", label: "Link to your work", type: "url", required: false },
      HOW_HEARD_FIELD,
    ],
  },
  {
    slug: "characters",
    name: "Characters & Immersive Performers",
    description: "Actors, dancers, character performers, makeup artists and immersive entertainers.",
    order: 3,
    fields: [
      { name: "performanceType", label: "What type of performance/character do you do?", type: "text", required: true },
      { name: "socialHandle", label: "Instagram / Social Media Handle", type: "text", required: true },
      { name: "portfolioLink", label: "Photo, video or portfolio link", type: "url", required: false },
      HOW_HEARD_FIELD,
    ],
  },
  {
    slug: "crew",
    name: "Afrospook Crew",
    description: "People interested in helping with the planning, production and execution of the festival.",
    order: 4,
    fields: [
      { name: "areaOfInterest", label: "Where would you like to help?", type: "select", required: true, options: ["Guest Experience", "Registration", "Production", "Backstage", "Logistics", "Vendor Support", "Media", "Other"] },
      { name: "eventExperience", label: "Have you worked at an event before?", type: "select", required: true, options: ["Yes", "No"] },
      HOW_HEARD_FIELD,
    ],
  },
  {
    slug: "vendors",
    name: "Vendors & Exhibitors",
    description: "Fashion, art, beauty, lifestyle, accessories, streetwear, merchandise, African brands, food, drink and catering. No vendor fees or detailed setup requirements are collected at this stage.",
    order: 5,
    fields: [
      { name: "businessName", label: "Business / Brand Name", type: "text", required: true },
      { name: "contactPerson", label: "Contact Person", type: "text", required: true },
      { name: "whatYouSell", label: "What do you sell?", type: "textarea", required: true },
      { name: "socialHandle", label: "Instagram / Social Media Handle", type: "text", required: true },
      HOW_HEARD_FIELD,
    ],
  },
  {
    slug: "brands-partners",
    name: "Brands & Experience Partners",
    description: "Corporate, lifestyle, financial, telecoms, beverage, fashion, media and community partners, plus gaming, sports and interactive experience/activation partners.",
    order: 6,
    fields: [
      { name: "companyName", label: "Company / Individual / Brand Name", type: "text", required: true },
      { name: "contactPerson", label: "Contact Person", type: "text", required: true },
      { name: "partnershipType", label: "What type of partnership/experience are you interested in?", type: "select", required: true, options: ["Sponsorship", "Product Partnership", "Activation", "Experience Partner", "Media Partnership", "Other"] },
      { name: "proposedCollaboration", label: "Tell us about your partnership idea or the experience you'd like to bring", type: "textarea", required: true },
      { name: "websiteSocial", label: "Website / Instagram / Portfolio", type: "url", required: false },
      HOW_HEARD_FIELD,
    ],
  },
];

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI environment variable is not set");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  for (const cat of CATEGORIES) {
    const { fields, ...rest } = cat;
    await Category.findOneAndUpdate(
      { slug: cat.slug },
      { ...rest, fields: withOrder(fields) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Seeded category: ${cat.slug}`);
  }

  // "food-drink" and "experiences" are retired — merged into
  // "vendors" and "brands-partners" respectively. Remove them so
  // stale categories don't linger in the DB after this re-run.
  const retiredSlugs = ["food-drink", "experiences"];
  const { deletedCount } = await Category.deleteMany({ slug: { $in: retiredSlugs } });
  if (deletedCount) {
    console.log(`Removed ${deletedCount} retired categories: ${retiredSlugs.join(", ")}`);
  }

  console.log("Done.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});