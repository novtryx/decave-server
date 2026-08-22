/**
 * One-time seed for the 8 Afrospook 2026 Open Call categories.
 * Run with: npx ts-node src/scripts/seedCategories.ts
 *
 * Safe to re-run — upserts by slug, so it won't create duplicates if
 * a category was already seeded, and re-running after editing a
 * category's fields here will push those edits live.
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

const CATEGORIES: SeedCategory[] = [
  {
    slug: "artists",
    name: "Artists & Performers",
    description: "Musicians, DJs, dancers, spoken word artists, live performers and cultural performers.",
    order: 1,
    fields: [
      { name: "stageName", label: "Artist / Stage Name", type: "text", required: true },
      { name: "performanceType", label: "Performance Type", type: "select", required: true, options: ["Music", "DJ", "Dance", "Spoken Word", "Live Performance", "Cultural Performance", "Other"] },
      { name: "genre", label: "Genre", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", required: true, helpText: "Tell us about your act" },
      { name: "yearsExperience", label: "Years of Experience", type: "number", required: true },
      { name: "previousPerformance", label: "Previous Performance Experience", type: "textarea", required: false },
      { name: "portfolio", label: "Portfolio / Previous Work", type: "url", required: false, placeholder: "https://drive.google.com/... or https://dropbox.com/...", helpText: "Paste a link to your work (Google Drive, Dropbox, portfolio site, etc.) — make sure sharing is set to \"Anyone with the link\"." },
      { name: "socialLinks", label: "Social Media Links", type: "text", required: false },
      { name: "performanceLinks", label: "Performance Links", type: "url", required: false, helpText: "YouTube, SoundCloud, etc." },
      { name: "availability", label: "Availability", type: "text", required: true },
      { name: "technicalRequirements", label: "Technical Requirements", type: "textarea", required: false },
      { name: "additionalInfo", label: "Additional Information", type: "textarea", required: false },
    ],
  },
  {
    slug: "creators",
    name: "Creators",
    description: "Photographers, videographers, UGC creators, social media creators and storytellers.",
    order: 2,
    fields: [
      { name: "creatorType", label: "Creator Type", type: "select", required: true, options: ["Photographer", "Videographer", "UGC Creator", "Social Media Creator", "Storyteller", "Other"] },
      { name: "specialization", label: "Specialization", type: "text", required: true },
      { name: "yearsExperience", label: "Years of Experience", type: "number", required: true },
      { name: "portfolio", label: "Portfolio", type: "url", required: true, placeholder: "https://drive.google.com/... or https://dropbox.com/...", helpText: "Paste a link to your work (Google Drive, Dropbox, portfolio site, etc.) — make sure sharing is set to \"Anyone with the link\"." },
      { name: "instagram", label: "Instagram", type: "text", required: false },
      { name: "tiktok", label: "TikTok", type: "text", required: false },
      { name: "youtube", label: "YouTube", type: "text", required: false },
      { name: "website", label: "Website", type: "url", required: false },
      { name: "previousEventExperience", label: "Previous Event Experience", type: "textarea", required: false },
      { name: "previousWork", label: "Previous Work", type: "url", required: false, placeholder: "https://drive.google.com/... or https://dropbox.com/...", helpText: "Paste a link to your work (Google Drive, Dropbox, portfolio site, etc.) — make sure sharing is set to \"Anyone with the link\"." },
      { name: "availability", label: "Availability", type: "text", required: true },
      { name: "additionalInfo", label: "Additional Information", type: "textarea", required: false },
    ],
  },
  {
    slug: "characters",
    name: "Characters & Immersive Performers",
    description: "Actors, dancers, character performers, makeup artists and immersive entertainers.",
    order: 3,
    fields: [
      { name: "performerType", label: "Performer Type", type: "select", required: true, options: ["Actor", "Dancer", "Character Performer", "Makeup Artist", "Immersive Entertainer", "Other"] },
      { name: "characterDescription", label: "Character Description", type: "textarea", required: true },
      { name: "relevantExperience", label: "Relevant Experience", type: "textarea", required: true },
      { name: "portfolio", label: "Portfolio", type: "url", required: false, placeholder: "https://drive.google.com/... or https://dropbox.com/...", helpText: "Paste a link to your work (Google Drive, Dropbox, portfolio site, etc.) — make sure sharing is set to \"Anyone with the link\"." },
      { name: "previousWork", label: "Previous Work", type: "url", required: false, placeholder: "https://drive.google.com/... or https://dropbox.com/...", helpText: "Paste a link to your work (Google Drive, Dropbox, portfolio site, etc.) — make sure sharing is set to \"Anyone with the link\"." },
      { name: "socialMedia", label: "Social Media", type: "text", required: false },
      { name: "availability", label: "Availability", type: "text", required: true },
      { name: "costumeRequirements", label: "Costume Requirements", type: "textarea", required: false },
      { name: "makeupRequirements", label: "Makeup Requirements", type: "textarea", required: false },
      { name: "additionalInfo", label: "Additional Information", type: "textarea", required: false },
    ],
  },
  {
    slug: "crew",
    name: "Afrospook Crew",
    description: "People interested in helping with the planning, production and execution of the festival.",
    order: 4,
    fields: [
      { name: "areaOfInterest", label: "Area of Interest", type: "select", required: true, options: ["Event Operations", "Security", "Guest Relations", "Production", "Marketing", "Media", "Logistics", "Registration", "Technical", "General Support"] },
      { name: "relevantSkills", label: "Relevant Skills", type: "textarea", required: true },
      { name: "previousExperience", label: "Previous Experience", type: "textarea", required: false },
      { name: "previousEventExperience", label: "Previous Event Experience", type: "textarea", required: false },
      { name: "availability", label: "Availability", type: "text", required: true },
      { name: "preferredRole", label: "Preferred Role", type: "text", required: false },
      { name: "whyJoin", label: "Why do you want to join the Afrospook crew?", type: "textarea", required: true },
      { name: "additionalInfo", label: "Additional Information", type: "textarea", required: false },
    ],
  },
  {
    slug: "vendors",
    name: "Vendors & Exhibitors",
    description: "Fashion, art, beauty, lifestyle, accessories, streetwear, merchandise and African brands.",
    order: 5,
    fields: [
      { name: "businessName", label: "Business Name", type: "text", required: true },
      { name: "businessCategory", label: "Business Category", type: "select", required: true, options: ["Fashion", "Art", "Beauty", "Lifestyle", "Accessories", "Streetwear", "Merchandise", "African Brands", "Other"] },
      { name: "businessDescription", label: "Business Description", type: "textarea", required: true },
      { name: "productsServices", label: "Products/Services", type: "textarea", required: true },
      { name: "yearsInBusiness", label: "Years in Business", type: "number", required: false },
      { name: "instagram", label: "Instagram", type: "text", required: false },
      { name: "website", label: "Website", type: "url", required: false },
      { name: "previousEventExperience", label: "Previous Event Experience", type: "textarea", required: false },
      { name: "portfolio", label: "Product Catalogue / Portfolio", type: "url", required: false, placeholder: "https://drive.google.com/... or https://dropbox.com/...", helpText: "Paste a link to your work (Google Drive, Dropbox, portfolio site, etc.) — make sure sharing is set to \"Anyone with the link\"." },
      { name: "spaceRequirements", label: "Space Requirements", type: "text", required: false },
      { name: "electricityRequirements", label: "Electricity Requirements", type: "text", required: false },
      { name: "additionalInfo", label: "Additional Information", type: "textarea", required: false },
    ],
  },
  {
    slug: "food-drink",
    name: "Food & Drink",
    description: "Restaurants, caterers, street food vendors, dessert brands, snack brands and beverage brands.",
    order: 6,
    fields: [
      { name: "businessName", label: "Business Name", type: "text", required: true },
      { name: "foodCategory", label: "Food/Drink Category", type: "select", required: true, options: ["Restaurant", "Caterer", "Street Food", "Dessert", "Snacks", "Beverages", "Other"] },
      { name: "businessDescription", label: "Business Description", type: "textarea", required: true },
      { name: "menu", label: "Menu", type: "textarea", required: false },
      { name: "menuUpload", label: "Menu Link", type: "url", required: false, placeholder: "https://drive.google.com/... or https://dropbox.com/...", helpText: "Paste a link to your menu (Google Drive, Dropbox, PDF link, etc.) — make sure sharing is set to \"Anyone with the link\"." },
      { name: "instagram", label: "Instagram", type: "text", required: false },
      { name: "website", label: "Website", type: "url", required: false },
      { name: "previousEventExperience", label: "Previous Event Experience", type: "textarea", required: false },
      { name: "equipmentRequirements", label: "Equipment Requirements", type: "textarea", required: false },
      { name: "electricityRequirements", label: "Electricity Requirements", type: "text", required: false },
      { name: "spaceRequirements", label: "Space Requirements", type: "text", required: false },
      { name: "foodPrepRequirements", label: "Food Preparation Requirements", type: "textarea", required: false },
      { name: "additionalInfo", label: "Additional Information", type: "textarea", required: false },
    ],
  },
  {
    slug: "experiences",
    name: "Experience Partners",
    description: "Gaming, sports challenges, interactive games, attractions, competitions and unique experiences.",
    order: 7,
    fields: [
      { name: "companyName", label: "Company/Organization Name", type: "text", required: true },
      { name: "experienceName", label: "Experience/Activation Name", type: "text", required: true },
      { name: "experienceType", label: "Type of Experience", type: "select", required: true, options: ["Gaming", "Sports Challenge", "Interactive Game", "Attraction", "Competition", "Other"] },
      { name: "experienceDescription", label: "Experience Description", type: "textarea", required: true },
      { name: "targetAudience", label: "Target Audience", type: "text", required: false },
      { name: "previousActivationExperience", label: "Previous Activation Experience", type: "textarea", required: false },
      { name: "portfolio", label: "Portfolio / Previous Work", type: "url", required: false, placeholder: "https://drive.google.com/... or https://dropbox.com/...", helpText: "Paste a link to your work (Google Drive, Dropbox, portfolio site, etc.) — make sure sharing is set to \"Anyone with the link\"." },
      { name: "spaceRequirements", label: "Space Requirements", type: "text", required: false },
      { name: "equipmentRequirements", label: "Equipment Requirements", type: "textarea", required: false },
      { name: "powerRequirements", label: "Power Requirements", type: "text", required: false },
      { name: "activationConcept", label: "Activation Concept", type: "textarea", required: false },
      { name: "socialWebsite", label: "Social Media / Website", type: "text", required: false },
      { name: "additionalInfo", label: "Additional Information", type: "textarea", required: false },
    ],
  },
  {
    slug: "brands-partners",
    name: "Brands & Partners",
    description: "Corporate, lifestyle, financial, telecoms, beverage, fashion, media, community and strategic partners.",
    order: 8,
    fields: [
      { name: "companyName", label: "Company/Organization Name", type: "text", required: true },
      { name: "industry", label: "Industry", type: "select", required: true, options: ["Corporate", "Lifestyle", "Financial", "Telecoms", "Beverage", "Fashion", "Media", "Community", "Other"] },
      { name: "companyDescription", label: "Company Description", type: "textarea", required: true },
      { name: "website", label: "Website", type: "url", required: false },
      { name: "socialMedia", label: "Social Media", type: "text", required: false },
      { name: "partnershipType", label: "Partnership Type", type: "text", required: true },
      { name: "proposedCollaboration", label: "Proposed Collaboration", type: "textarea", required: true },
      { name: "activationIdeas", label: "Activation Ideas", type: "textarea", required: false },
      { name: "sponsorshipInterest", label: "Sponsorship Interest", type: "textarea", required: false },
      { name: "previousPartnershipExperience", label: "Previous Partnership Experience", type: "textarea", required: false },
      { name: "contactPerson", label: "Contact Person", type: "text", required: true },
      { name: "additionalInfo", label: "Additional Information", type: "textarea", required: false },
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

  console.log("Done.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});