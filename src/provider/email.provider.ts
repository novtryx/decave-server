import { zeptoClient } from "../config/mailer";

export const sendOtpEmail = async (email: string, otp: string) => {
  await zeptoClient.post("/email", {
    from: {
      address: "info@decavemgt.com",
      name: "DeCave Security",
    },
    to: [
      {
        email_address: {
          address: email,
          name: email.split("@")[0],
        },
      },
    ],
    subject: "Your Login OTP",
    htmlbody: `
      <div style="font-family: Arial, sans-serif; color: #111;">
        <p>Hello,</p>

        <p>Use the one-time password below to complete your login:</p>

        <div style="margin: 20px 0;">
          <h2 style="letter-spacing: 4px;">${otp}</h2>
        </div>

        <p>
          This code is valid for <strong>5 minutes</strong>.
          Please do not share it with anyone.
        </p>

        <p style="margin-top: 30px;">
          — DeCave Security
        </p>
      </div>
    `,
  });
};

/**
 * Single-recipient HTML send, shared by anything that needs to email
 * one person a full templated body (as opposed to bulkMail.ts, which
 * is built for one email BCC'd to a large recipient list). Used by
 * the open call notifications: applicant status changes, and the
 * admin new-submission alert.
 */
export const sendTransactionalEmail = async (
  to: { email: string; name?: string },
  subject: string,
  htmlBody: string
) => {
  await zeptoClient.post("/email", {
    from: {
      address: "info@decavemgt.com",
      name: "DeCave Management",
    },
    to: [
      {
        email_address: {
          address: to.email,
          name: to.name || to.email.split("@")[0],
        },
      },
    ],
    subject,
    htmlbody: htmlBody,
  });
};