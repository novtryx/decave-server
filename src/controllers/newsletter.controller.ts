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



export const getAllSubscribedEmail = async (req:Request, res:Response) => {

  try {
    
    const subscribedEmail = await newsletterModel.find().lean()

    return res.status(200).json({
      success: true,
      data: subscribedEmail
    })
  } catch (error: any) {
    return res.status(500).json({
      message: "Failed to subscribe",
      error: error.message,
      success: false
    });
  }
}

export const sendNewsletter = async (
  req: Request,
  res: Response
) => {
  try {
    const { subject, body, emails } = req.body;

    // 🔹 Basic validation
    if (!subject || !body || !emails) {
      return res.status(400).json({
        message: "Subject, body and emails are required"
      });
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        message: "Emails must be a non-empty array"
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;

    // 🔹 Validate each email
    const invalidEmails = emails.filter(
      (email: string) => !emailRegex.test(email)
    );

    if (invalidEmails.length > 0) {
      return res.status(400).json({
        message: "Some emails are invalid",
        invalidEmails
      });
    }

    // 🔹 Send newsletter
    await transporter.sendMail({
      from: '"DeCave Management" <info@decavemgt.com>',
      bcc: emails,
      subject,
      html: newsletterTemplate(
        `https://decave-demo-server.vercel.app/decave-logo.png`,
        body
      )
    });

    return res.status(200).json({
      message: "Newsletter sent successfully"
    });

  } catch (error: any) {
    return res.status(500).json({
      message: "Failed to send newsletter",
      error: error.message
    });
  }
};