// import nodemailer from "nodemailer";

// export const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });


import nodemailer from "nodemailer";
import { SendMailClient } from "zeptomail";


export const transporter = nodemailer.createTransport({
  host: "smtppro.zoho.com",
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


const url = "https://api.zeptomail.com/v1.1/email";

export const client = new SendMailClient({
  url,
  token: process.env.ZEPTO_API_KEY!,
});
