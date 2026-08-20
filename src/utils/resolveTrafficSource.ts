/**
 * Normalizes "where did this visitor come from" down to a small set
 * of known buckets, so the dashboard can group by them instead of
 * showing a hundred slightly-different raw referrer strings.
 *
 * Priority: explicit ?utm_source= always wins (the link creator said
 * exactly what this is) — only falls back to parsing the Referer
 * header when no utm_source was set, which covers untagged shares
 * (someone pasting the bare URL into a WhatsApp chat, a link in an
 * Instagram bio, etc).
 */

const KNOWN_SOURCES = [
  "instagram",
  "whatsapp",
  "twitter",
  "facebook",
  "tiktok",
  "google",
  "direct",
  "other",
] as const;

export type TrafficSource = (typeof KNOWN_SOURCES)[number];

// Hostname fragments -> normalized source. Checked with .includes(),
// so subdomains (l.instagram.com, business.facebook.com, etc.) match.
const HOST_MAP: Array<[string, TrafficSource]> = [
  ["instagram.com", "instagram"],
  ["wa.me", "whatsapp"],
  ["whatsapp.com", "whatsapp"],
  ["twitter.com", "twitter"],
  ["x.com", "twitter"],
  ["t.co", "twitter"],
  ["facebook.com", "facebook"],
  ["fb.me", "facebook"],
  ["tiktok.com", "tiktok"],
  ["google.", "google"], // google.com, google.co.uk, etc.
];

function normalizeUtmSource(raw: string): TrafficSource {
  const value = raw.trim().toLowerCase();
  if ((KNOWN_SOURCES as readonly string[]).includes(value)) {
    return value as TrafficSource;
  }
  // Common aliases people actually type into their own links.
  if (value === "ig") return "instagram";
  if (value === "wa" || value === "wapp") return "whatsapp";
  if (value === "fb") return "facebook";
  if (value === "x" || value === "tw") return "twitter";
  return "other";
}

function hostFromReferrer(referer: string | undefined | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function sourceFromHost(host: string | null): TrafficSource {
  if (!host) return "direct"; // no referrer at all = typed URL, bookmark, or a privacy-stripped app browser
  const match = HOST_MAP.find(([fragment]) => host.includes(fragment));
  return match ? match[1] : "other";
}

export interface ResolvedTrafficSource {
  source: TrafficSource;
  medium: string | null;
  campaign: string | null;
  referrerHost: string | null;
}

export function resolveTrafficSource(params: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referer?: string | null;
}): ResolvedTrafficSource {
  const { utmSource, utmMedium, utmCampaign, referer } = params;
  const referrerHost = hostFromReferrer(referer);

  const source =
    utmSource && utmSource.trim().length > 0
      ? normalizeUtmSource(utmSource)
      : sourceFromHost(referrerHost);

  return {
    source,
    medium: utmMedium?.trim() || null,
    campaign: utmCampaign?.trim() || null,
    referrerHost,
  };
}