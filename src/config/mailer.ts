// import nodemailer from "nodemailer";

// export const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });


import nodemailer from "nodemailer";
import axios from "axios";
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

// Shared REST client for ZeptoMail's bulk/BCC send endpoint. Anything
// that needs to send bulk transactional/marketing email (newsletter,
// event feedback requests, etc.) should reuse this instead of
// creating its own axios instance.
export const zeptoClient = axios.create({
  baseURL: "https://api.zeptomail.com/v1.1",
  headers: {
    Authorization: process.env.ZEPTO_API_KEY!,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 10000,
});