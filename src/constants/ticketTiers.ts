// Canonical list of ticket tier categories used across the platform.
// Kept as a flat string enum (not a sub-document) so existing tickets
// with no category set remain valid — they just fall back to
// "standard" wherever a category is displayed.

export const TICKET_TIER_CATEGORIES = [
  "early_access",
  "first_release",
  "standard",
  "final",
  "gate",
  "vip",
  "table",
  "complimentary",
  "sponsor_guest",
  "influencer_guest",
] as const;

export type TicketTierCategory = (typeof TICKET_TIER_CATEGORIES)[number];

export const DEFAULT_TICKET_TIER_CATEGORY: TicketTierCategory = "standard";

export const TICKET_TIER_LABELS: Record<TicketTierCategory, string> = {
  early_access: "Early Access",
  first_release: "First Release",
  standard: "Standard",
  final: "Final",
  gate: "Gate",
  vip: "VIP",
  table: "Table",
  complimentary: "Complimentary",
  sponsor_guest: "Sponsor Guest",
  influencer_guest: "Influencer Guest",
}; 