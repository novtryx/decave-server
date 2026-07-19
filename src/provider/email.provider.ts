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