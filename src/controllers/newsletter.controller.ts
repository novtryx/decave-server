import { Request, Response } from "express";
import Newsletter from "../models/newsletter.model";
import { transporter } from "../config/mailer";
import { newsletterSubscribedEmail } from "../utils/newsletterSubscribed";
import newsletterModel from "../models/newsletter.model";
import { newsletterTemplate } from "../utils/newsletterBulkMail";

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
        `https://decave-demo-server.vercel.app/decave-logo.png`
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

export const sendNewsletter = async (req: Request, res: Response) => {
  try {
    const { subject, body, emails, sendToAll } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ message: "Subject and body are required" });
    }

    let targetEmails: string[] = [];

    if (sendToAll) {
      // Fetch all emails directly from DB — no pagination limit
      const allSubscribers = await newsletterModel.find().select("email").lean();
      targetEmails = allSubscribers.map((s) => s.email);

      if (targetEmails.length === 0) {
        return res.status(400).json({ message: "No subscribers found" });
      }
    } else {
      // Specific emails provided by frontend
      if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: "Emails must be a non-empty array" });
      }

      const emailRegex = /^\S+@\S+\.\S+$/;
      const invalidEmails = emails.filter((email: string) => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        return res.status(400).json({ message: "Some emails are invalid", invalidEmails });
      }

      targetEmails = emails;
    }

    await transporter.sendMail({
      from: '"DeCave Management" <info@decavemgt.com>',
      bcc: targetEmails,
      subject,
      html: newsletterTemplate(
        `https://decave-demo-server.vercel.app/decave-logo.png`,
        body
      ),
    });

    return res.status(200).json({
      message: "Newsletter sent successfully",
      sentCount: targetEmails.length,
      success: true,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Failed to send newsletter",
      error: error.message,
    });
  }
};