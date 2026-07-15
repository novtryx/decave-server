// Suggested categories for manual finance entries. Kept as plain
// string lists (not a strict enum on the model) so an admin can still
// type something else without the entry being rejected — these are
// here to drive the dropdown UI and keep most entries consistent.

export const EXPENSE_CATEGORIES = [
  "venue",
  "sound",
  "lights",
  "media",
  "security",
  "logistics",
  "djs_talent",
  "influencer_payout",
  "printing",
  "marketing",
  "operations",
  "other",
] as const;

export const INCOME_CATEGORIES = [
  "ticket_sales",
  "sponsorship",
  "vendor_fee",
  "merchandise",
  "other",
] as const;

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  venue: "Venue",
  sound: "Sound",
  lights: "Lights",
  media: "Media",
  security: "Security",
  logistics: "Logistics",
  djs_talent: "DJs / Talent",
  influencer_payout: "Influencer Payout",
  printing: "Printing",
  marketing: "Marketing",
  operations: "Operations",
  other: "Other",
};

export const INCOME_CATEGORY_LABELS: Record<string, string> = {
  ticket_sales: "Ticket Sales",
  sponsorship: "Sponsorship",
  vendor_fee: "Vendor Fee",
  merchandise: "Merchandise",
  other: "Other",
};