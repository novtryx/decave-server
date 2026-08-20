import { Request, Response } from "express";
import mongoose from "mongoose";
import PageVisit from "../models/pageVisit.model";
import { resolveTrafficSource } from "../utils/resolveTrafficSource";

/**
 * Fire-and-forget visit logger, called once when an event page
 * mounts on the client. Deliberately forgiving: a malformed or
 * missing field here should never surface as an error to the
 * visitor, since this is a tracking side-effect, not part of the
 * core purchase flow.
 */
export const trackPageVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, sessionRef, utmSource, utmMedium, utmCampaign } = req.body || {};

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      res.status(400).json({ success: false, message: "Valid eventId is required" });
      return;
    }
    if (!sessionRef || typeof sessionRef !== "string") {
      res.status(400).json({ success: false, message: "sessionRef is required" });
      return;
    }

    const resolved = resolveTrafficSource({
      utmSource,
      utmMedium,
      utmCampaign,
      referer: req.get("referer"),
    });

    await PageVisit.create({
      event: eventId,
      source: resolved.source,
      medium: resolved.medium,
      campaign: resolved.campaign,
      referrerHost: resolved.referrerHost,
      sessionRef,
    });

    res.status(201).json({ success: true });
  } catch (error: any) {
    // Never let a tracking failure look like a real error to the
    // client — log it and return 200 anyway so nothing on the
    // frontend needs to handle/retry this.
    console.error("Error tracking page visit:", error);
    res.status(200).json({ success: false });
  }
};