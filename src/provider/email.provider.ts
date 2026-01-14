import {transporter} from '../config/mailer'

export const sendOtpEmail = async (email: string, otp: string) => {
  await transporter.sendMail({
    to: email,
    subject: "Your Login OTP",
    html: `
      <p>Your OTP is:</p>
      <h2>${otp}</h2>
      <p>This OTP expires in 5 minutes.</p>
    `,
  });
};
