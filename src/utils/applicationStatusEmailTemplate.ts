import { ApplicationStatus } from "../models/application.model";

// "draft" is pre-submission — there's nothing to notify about until
// the applicant actually submits. Every real status from "submitted"
// onward has applicant-facing copy here.
const STATUS_COPY: Partial<Record<ApplicationStatus, { subject: string; heading: string; body: string }>> = {
  submitted: {
    subject: "We've received your Afrospook 2026 application",
    heading: "Application received ✅",
    body: "Thanks for applying to Afrospook 2026! We've received your application and our team will review it shortly. We'll email you again as soon as there's an update.",
  },
  under_review: {
    subject: "Your Afrospook 2026 application is under review",
    heading: "Your application is under review",
    body: "Our team has started reviewing your application. There's nothing further you need to do right now — we'll be in touch with an update soon.",
  },
  shortlisted: {
    subject: "You've been shortlisted for Afrospook 2026!",
    heading: "You've been shortlisted 🎉",
    body: "Great news — you've been shortlisted for Afrospook 2026. Our team will follow up shortly with next steps.",
  },
  accepted: {
    subject: "You're confirmed for Afrospook 2026!",
    heading: "You're in! 🎉",
    body: "Congratulations — your application has been accepted. Our team will be in touch with everything you need to know ahead of the event.",
  },
  rejected: {
    subject: "An update on your Afrospook 2026 application",
    heading: "Application update",
    body: "Thank you for applying to Afrospook 2026. After careful review, we're unable to move forward with your application on this occasion. We'd love to see you apply again for a future event.",
  },
};

export function getApplicationStatusEmailContent(status: ApplicationStatus) {
  return STATUS_COPY[status] || null;
}

export const applicationStatusEmailTemplate = (
  logoUrl: string,
  applicantName: string,
  categoryName: string,
  heading: string,
  body: string
) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>${heading}</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
        ${heading} — Afrospook 2026 Open Call
      </div>

      <div style="padding:40px 20px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

          <div style="background:#111827; padding:30px; text-align:center;">
            <img src="${logoUrl}" alt="deCave Logo" style="height:45px;" />
          </div>

          <div style="padding:40px 30px; color:#374151; font-size:15px; line-height:1.8;">
            <h2 style="margin:0 0 16px 0; color:#111827; font-size:20px;">${heading}</h2>
            <p style="margin:0 0 12px 0;">Hi ${applicantName},</p>
            <p style="margin:0 0 20px 0;">${body}</p>
            <p style="margin:0; font-size:13px; color:#6b7280;">
              Category: <strong>${categoryName}</strong>
            </p>
          </div>

          <hr style="border:none; border-top:1px solid #e5e7eb; margin:0 30px;" />

          <div style="padding:25px 30px; text-align:center; font-size:12px; color:#9ca3af; line-height:1.6;">
            <p style="margin:0;">
              deCave Mgt © ${new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>

        <div style="text-align:center; margin-top:20px; font-size:11px; color:#9ca3af;">
          Where culture meets experience.
        </div>
      </div>
    </body>
  </html>
`;