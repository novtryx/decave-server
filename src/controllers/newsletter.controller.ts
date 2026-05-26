import { Request, Response } from "express";
import Newsletter from "../models/newsletter.model";
import { client, transporter } from "../config/mailer";
import { newsletterSubscribedEmail } from "../utils/newsletterSubscribed";
import newsletterModel from "../models/newsletter.model";
import { newsletterTemplate } from "../utils/newsletterBulkMail";
import axios from "axios";

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
export const maxDuration = 300; // 5 minutes — Vercel Pro only

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const zeptoClient = axios.create({
  baseURL: "https://api.zeptomail.com/v1.1",
  headers: {
    Authorization: process.env.ZEPTO_API_KEY!,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 10000,
});

const sendSingleMail = async (
  email: string,
  subject: string,
  body: string
) => {
  return zeptoClient.post("/email", {
    from: {
      address: "info@decavemgt.com",
      name: "DeCave Management",
    },
    to: [
      {
        email_address: {
          address: email,
          name: email.split("@")[0],
        },
      },
    ],
    subject,
    htmlbody: newsletterTemplate(
      `https://decave-demo-server.vercel.app/decave-logo.png`,
      body
    ),
  });
};

const sendInBatches = async (
  emails: string[],
  subject: string,
  body: string
): Promise<{ sent: number; failed: string[] }> => {
  const batches: string[][] = [];

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE));
  }

  let totalSent = 0;
  const failedEmails: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    const results = await Promise.allSettled(
      batch.map((email) => sendSingleMail(email, subject, body))
    );

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        totalSent++;
      } else {
        const reason = result.reason?.response?.data || result.reason?.message;
        console.error(`❌ Failed for ${batch[index]}:`, reason);
        failedEmails.push(batch[index]);
      }
    });

    console.log(
      `✅ Batch ${i + 1}/${batches.length} processed (${batch.length} emails)`
    );

    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { sent: totalSent, failed: failedEmails };
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

    // Split into batches of 50
    const batches: string[][] = [];
    for (let i = 0; i < targetEmails.length; i += 50) {
      batches.push(targetEmails.slice(i, i + 50));
    }

    let totalSent = 0;
    const failedBatches: number[] = [];

    // Send all batches concurrently — no waiting between them
    const results = await Promise.allSettled(
      batches.map((batch, index) =>
        zeptoClient.post("/email", {
          from: {
            address: "info@decavemgt.com",
            name: "DeCave Management",
          },
          to: [
            {
              email_address: {
                address: "info@decavemgt.com",
                name: "DeCave Management",
              },
            },
          ],
          bcc: batch.map((email) => ({
            email_address: {
              address: email,
              name: email.split("@")[0],
            },
          })),
          subject,
          htmlbody: newsletterTemplate(
            `https://decave-demo-server.vercel.app/decave-logo.png`,
            body
          ),
        })
      )
    );

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        totalSent += batches[index].length;
        console.log(`✅ Batch ${index + 1}/${batches.length} sent`);
      } else {
        console.error(
          `❌ Batch ${index + 1} failed:`,
          result.reason?.response?.data || result.reason?.message
        );
        failedBatches.push(index + 1);
      }
    });

    return res.status(200).json({
      message: "Newsletter sent successfully",
      sentCount: totalSent,
      failedBatches: failedBatches.length > 0 ? failedBatches : undefined,
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