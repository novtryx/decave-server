import { Request, Response } from "express";
import Newsletter from "../models/newsletter.model";
import { transporter } from "../config/mailer";
import { newsletterSubscribedEmail } from "../utils/newsletterSubscribed";
import newsletterModel from "../models/newsletter.model";
import { newsletterTemplate } from "../utils/newsletterBulkMail";
import { sendBulkEmail } from "../utils/bulkMail";
import Applicant from "../models/applicant.model";

export const subscribeToNewsletter = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    // 🔹 Basic validation
    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email address"
      });
    }

    // 🔹 Check existing subscription
    const exists = await Newsletter.findOne({ email });
    if (exists) {
      return res.status(200).json({
        message: "Email already subscribed"
      });
    }

    // 🔹 Save subscriber
    await Newsletter.create({ email });

    // 🔹 Send confirmation email
    await transporter.sendMail({
    from: '"DeCave Management " <info@decavemgt.com>',
      to: email,
      subject: "Newsletter Subscription Confirmed",
      html: newsletterSubscribedEmail(
        `https://api.decavemgt.com/decave-logo.png`
      )
    });

    return res.status(201).json({
      message: "Successfully subscribed to newsletter"
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Failed to subscribe",
      error: error.message
    });
  }
};


export const unsubscribeFromNewsletter = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    // 🔹 Validate email
    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email address"
      });
    }

    // 🔹 Check if email exists
    const subscriber = await Newsletter.findOne({ email });

    if (!subscriber) {
      return res.status(404).json({
        message: "Email not found in subscription list",
        success: false
      });
    }

    // 🔹 Delete subscriber
    await Newsletter.deleteOne({ email });

    return res.status(200).json({
      message: "Successfully unsubscribed from newsletter",
      success: true
    });

  } catch (error: any) {
    return res.status(500).json({
      message: "Failed to unsubscribe",
      error: error.message,
      success: false
    });
  }
};



export const getAllSubscribedEmail = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [subscribedEmail, total] = await Promise.all([
      newsletterModel.find().skip(skip).limit(limit).lean(),
      newsletterModel.countDocuments(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: subscribedEmail,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }); 
  } catch (error: any) {
    return res.status(500).json({
      message: "Failed to fetch subscribed emails",
      error: error.message,
      success: false,
    });
  }
};
// 🔹 Public, no-auth sync endpoint. Pull every open-call Applicant
// email and auto-subscribe (auto-"certify") it to the newsletter list
// — no double opt-in step. Safe to hit repeatedly: emails already on
// the list are skipped, so nothing is duplicated and no repeat
// confirmation emails go out.
export const syncOpenCallApplicantsToNewsletter = async (
  req: Request,
  res: Response
) => {
  try {
    const applicants = await Applicant.find({}, "email").lean();

    if (applicants.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No open call applicants found",
        totalApplicants: 0,
        added: 0,
        alreadySubscribed: 0,
      });
    }

    // Applicant.email is already validated + lowercased at the schema
    // level, but normalize again here since we're about to diff it
    // against Newsletter.email (also lowercased/trimmed).
    const applicantEmails = Array.from(
      new Set(
        applicants
          .map((a: any) => a.email?.toLowerCase().trim())
          .filter(Boolean)
      )
    );

    const existing = await Newsletter.find(
      { email: { $in: applicantEmails } },
      "email"
    ).lean();
    const existingSet = new Set(existing.map((e) => e.email));

    const newEmails = applicantEmails.filter(
      (email) => !existingSet.has(email)
    );

    if (newEmails.length > 0) {
      // insertMany with ordered:false so one duplicate-key race
      // (e.g. someone manually subscribing at the same moment) can't
      // abort the rest of the batch.
      await Newsletter.insertMany(
        newEmails.map((email) => ({ email })),
        { ordered: false }
      );

      // Best-effort confirmation email — failures here shouldn't fail
      // the sync itself, the subscription record is already saved.
      try {
        await sendBulkEmail(
          newEmails,
          "Newsletter Subscription Confirmed",
          newsletterSubscribedEmail(`https://api.decavemgt.com/decave-logo.png`)
        );
      } catch (mailErr: any) {
        console.error(
          "Open-call → newsletter sync: confirmation email batch failed:",
          mailErr.message
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Open call applicants synced to newsletter",
      totalApplicants: applicantEmails.length,
      added: newEmails.length,
      alreadySubscribed: applicantEmails.length - newEmails.length,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to sync open call applicants to newsletter",
      error: error.message,
    });
  }
};

export const sendNewsletter = async (req: Request, res: Response) => {
  try {
    const { subject, body, emails, sendToAll } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ message: "Subject and body are required" });
    }

    let targetEmails: string[] = [];

    if (sendToAll) {
      const allSubscribers = await newsletterModel
        .find()
        .select("email")
        .lean();
      targetEmails = allSubscribers.map((s) => s.email);

      if (targetEmails.length === 0) {
        return res.status(400).json({ message: "No subscribers found" });
      }
    } else {
      if (!Array.isArray(emails) || emails.length === 0) {
        return res
          .status(400)
          .json({ message: "Emails must be a non-empty array" });
      }

      const emailRegex = /^\S+@\S+\.\S+$/;
      const invalidEmails = emails.filter(
        (email: string) => !emailRegex.test(email)
      );
      if (invalidEmails.length > 0) {
        return res
          .status(400)
          .json({ message: "Some emails are invalid", invalidEmails });
      }

      targetEmails = emails;
    }

    const htmlBody = newsletterTemplate(
      `https://api.decavemgt.com/decave-logo.png`,
      body
    );

    const result = await sendBulkEmail(targetEmails, subject, htmlBody);

    return res.status(200).json({
      message: "Newsletter sent successfully",
      sentCount: result.sentCount,
      failedBatches: result.failedBatches.length > 0 ? result.failedBatches : undefined,
      success: true,
    });

  } catch (error: any) {
    console.log("Error:", JSON.stringify(error.response?.data, null, 2));

    return res.status(500).json({
      message: "Failed to send newsletter",
      error: error.response?.data?.message || error.message,
      details: error.response?.data,
    });
  }
};