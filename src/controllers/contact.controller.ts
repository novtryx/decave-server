import { Request, Response } from "express";
import adminModel from "../models/admin.model";
import ContactInquiry from "../models/contactInquiry.model";
import { sendTransactionalEmail } from "../provider/email.provider";
import { newInquiryAdminEmailTemplate } from "../utils/newInquiryAdminEmailTemplate";
import { inquiryConfirmationEmailTemplate } from "../utils/inquiryConfirmationEmailTemplate";

const LOGO_URL = "https://decave-demo-server.vercel.app/decave-logo.png";

export const submitInquiry = async (req: Request, res: Response) => {
  try {
    const { fullName, email, phoneNumber, inquiryType, message } = req.body;

    const inquiry = await ContactInquiry.create({
      fullName,
      email,
      phoneNumber,
      inquiryType,
      message,
    });

    // Both emails are fire-and-forget from the response's perspective
    // — a mail provider hiccup should never turn a successfully saved
    // inquiry into a failed submission for the person filling the form.
    notifyAdminsOfInquiry(fullName, email, phoneNumber, inquiryType, message);
    sendInquiryConfirmation(fullName, email, inquiryType);

    res.status(201).json({
      success: true,
      message: "Thanks for reaching out — we've received your message and will get back to you within 24–48 hours.",
      data: { id: inquiry._id },
    });
  } catch (error: any) {
    console.error("Error submitting contact inquiry:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong sending your message. Please try again in a moment.",
    });
  }
};

async function notifyAdminsOfInquiry(
  fullName: string,
  email: string,
  phoneNumber: string,
  inquiryType: string,
  message: string
) {
  try {
    const admins = await adminModel.find().select("email supportEmail");
    const recipients = admins
      .map((a: any) => a.supportEmail || a.email)
      .filter((e: string | undefined): e is string => !!e);

    if (recipients.length === 0) {
      console.warn("No admin email found to notify of new contact inquiry");
      return;
    }

    const html = newInquiryAdminEmailTemplate(LOGO_URL, fullName, email, phoneNumber, inquiryType, message);
    await Promise.allSettled(
      recipients.map((recipient) =>
        sendTransactionalEmail({ email: recipient }, `New ${inquiryType} inquiry — ${fullName}`, html)
      )
    );
  } catch (error: any) {
    console.error("Failed to send admin inquiry notification:", error.message);
  }
}

async function sendInquiryConfirmation(fullName: string, email: string, inquiryType: string) {
  try {
    const html = inquiryConfirmationEmailTemplate(LOGO_URL, fullName, inquiryType);
    await sendTransactionalEmail({ email, name: fullName }, "We've received your message — deCave", html);
  } catch (error: any) {
    console.error("Failed to send inquiry confirmation email:", error.message);
  }
}