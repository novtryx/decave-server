import { Request, Response } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import paystack from "../services/paystack.service";
import transactionHistoryModel from "../models/transactionHistory.model";
import eventModel from "../models/event.model";
import transactionService from "../services/transaction.service";
import { InfluencerModel } from "../models/influencer.model";
import { generateTicketPDF, ticketEmailTemplate } from "../utils/ticketEmailTemplate";
import { transporter } from "../config/mailer";
import newsletterModel from "../models/newsletter.model";


const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const INFLUENCER_PERCENTAGE = 10;

const generateBuyerTicketId = (ticketName: string) => {
  const prefix = ticketName.slice(0, 3).toUpperCase();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${random}`;
};

const calculatePaystackCharge = (amount: number) => {
  const percentage = 0 * amount;
  const charge = percentage ;
  return Math.min(charge, 2000);
};

export const purchaseTicket = async (req: Request, res: Response) => {
  try {
    const { eventId, ticketId, buyers, amount, referralCode, groupTicket = false, } = req.body;

    if (!buyers || buyers.length === 0) {
      return res.status(400).json({ message: "Buyers required" });
    }

    // 1️⃣ Find event
    const event = await eventModel.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // 2️⃣ Find ticket in event
    const ticket = event.tickets.find(
      (t: any) => t?._id?.toString() === ticketId
    );
    if (!ticket) return res.status(404).json({ message: "Ticket not found in event" });

    // 3️⃣ Check availability
    const totalQuantity = buyers.reduce(
      (sum: number, b: any) => sum + (b.quantity || 1),
      0
    );
    if (totalQuantity > ticket.availableQuantity) {
      return res.status(400).json({ message: "Not enough tickets available" });
    }

    // 4️⃣ Resolve referral code → adjust amount
    let finalAmount = amount;
    let influencer = null;

    if (referralCode) {
      influencer = await InfluencerModel.findOne({
        referralCode: referralCode.toUpperCase().trim(),
      });

      if (influencer) {
        if (!influencer.influencersTakesPercentage) {
          // Influencer is NOT taking a cut → discount the buyer instead
          const discount = (INFLUENCER_PERCENTAGE / 100) * amount;
          finalAmount = amount - discount;
        }
        // If influencer IS taking percentage → buyer pays full price;
        // influencer gets credited in the webhook after payment succeeds
      }
    }

    // 5️⃣ Generate reference & TXN id
    const rawRef = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const txnId = `TXN-${rawRef}`;

    // 6️⃣ Expand buyers → individual tickets with QR codes
    const expandedBuyers = [];

    for (const buyer of buyers) {
      const qty = buyer.quantity || 1;
      for (let i = 0; i < qty; i++) {
        const buyerTicketId = generateBuyerTicketId(event.eventDetails.eventTitle);
        const qrPayload = `https://decavemgt.com/ticket?txnId=${txnId}&ticketId=${buyerTicketId}`;
        const qrCode = await QRCode.toDataURL(qrPayload);

        expandedBuyers.push({
          fullName: buyer.fullName,
          email: buyer.email,
          phoneNumber: buyer.phoneNumber,
          ticketId: buyerTicketId,
          checkedIn: false,
          qrCode,
        });
      }
    }

    // 7️⃣ Create pending transaction (store influencer id if present)
    const transaction = await transactionHistoryModel.create({
      txnId,
      event: eventId,
      ticket: ticketId,
      buyers: expandedBuyers,
      status: "pending",
      paystackId: "INIT",
      ...(influencer && { influencer: influencer._id }),
    });

    // 8️⃣ Init Paystack with the (possibly discounted) amount
    const paystackFee = calculatePaystackCharge(finalAmount);
    const totalCharge = finalAmount + paystackFee;

    const response = await paystack.post("/transaction/initialize", {
      email: buyers[0].email,
      amount: Math.round(totalCharge * 100),
      reference: rawRef,
      metadata: { txnId, transactionId: transaction._id },
      //  callback_url: "http://localhost:3000/checkout/success",
      callback_url: "https://decavemgt.com/checkout/success",
    });

    res.status(200).json({
      authorization_url: response.data.data.authorization_url,
      txnId,
      transaction,
    });
  } catch (err) {
    console.error("PURCHASE ERROR:", err);
    res.status(500).json({ message: "Ticket purchase failed", err });
  }
};

// ─────────────────────────────────────────────
// WEBHOOK — Paystack calls this after payment
// ─────────────────────────────────────────────
export const paystackWebhook = async (req: Request, res: Response) => {
  // 1️⃣ Verify Paystack signature
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  // Acknowledge immediately — Paystack expects a fast 200
  res.status(200).json({ received: true });

  const { event, data } = req.body;

  // Only handle successful charges
  if (event !== "charge.success") return;

  try {
    const reference = data.reference;

    // 2️⃣ Find transaction (no populate)
    const transaction = await transactionHistoryModel.findOne({
      txnId: `TXN-${reference}`,
    });

    if (!transaction || transaction.status === "completed") return;

    // 3️⃣ Mark completed
    transaction.status = "completed";
    transaction.paystackId = data.id;
    await transaction.save();

    // 4️⃣ Deduct ticket quantity
    const event_ = await eventModel.findById(transaction.event);
    if (!event_) return;

    const ticket = event_.tickets.find(
      (t: any) => t._id.toString() === transaction.ticket.toString()
    );
    if (!ticket) return;

    ticket.availableQuantity = Math.max(
      ticket.availableQuantity - transaction.buyers.length,
      0
    );
    await event_.save();
    await transactionService.invalidateDashboardCache();

    // 5️⃣ Handle influencer commission
   if (transaction.influencer) {
  const influencer = await InfluencerModel.findById(transaction.influencer.toString());
 
  console.log("Influencer found by string:", influencer);
  if (influencer) {
    const paidAmount = data.amount / 100;
    const commission = influencer.influencersTakesPercentage
      ? (INFLUENCER_PERCENTAGE / 100) * paidAmount
      : 0;

    const updated = await InfluencerModel.findByIdAndUpdate(
      transaction.influencer,
      {
        $inc: {
          amount: commission,
          buyers: transaction.buyers.length,
        },
      },
      { new: true }
    );

    console.log("Influencer updated:", updated);
  }
}

    // 6️⃣ Send ticket emails
    for (const buyer of transaction.buyers) {
      try {
        const pdfBuffer = await generateTicketPDF({
          buyer,
          event: event_.eventDetails,
          ticket,
          transaction,
        });

        await transporter.sendMail({
          from: '"DeCave Ticket " <info@decavemgt.com>',
          to: buyer.email,
          subject: `Your Ticket for ${event_.eventDetails.eventTitle}`,
          html: ticketEmailTemplate({ buyer, event: event_.eventDetails, ticket, transaction }),
          attachments: [
            {
              filename: `Ticket-${buyer.ticketId}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        });
      } catch (err) {
        console.error("Email failed for:", buyer.email, err);
      }
    }

     for (const buyer of transaction.buyers) {
      try {
        await newsletterModel.updateOne(
          { email: buyer.email.toLowerCase().trim() },
          { $setOnInsert: { email: buyer.email.toLowerCase().trim() } },
          { upsert: true }
        );
      } catch (err) {
        // Silently skip — newsletter failure should never affect ticket flow
        console.error("Newsletter subscription failed for:", buyer.email, err);
      }
    }
  } catch (err) {
    console.error("WEBHOOK PROCESSING ERROR:", err);
  }
};


export const validateReferralCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    console.log("Raw code received:", code);
    console.log("Transformed code:", typeof code === "string" ? code.toUpperCase().trim() : null);

    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Referral code is required" });
    }

    const transformed = code.toUpperCase().trim();

    // Debug: see ALL influencers and their referral codes
    const all = await InfluencerModel.find({}).select("referralCode email");
    console.log("All influencers in DB:", JSON.stringify(all, null, 2));

    const influencer = await InfluencerModel.findOne({
      referralCode: transformed,
    }).select("referralCode influencersTakesPercentage percentage");

    console.log("Query result:", influencer);

    if (!influencer) {
      return res.status(404).json({ message: "Invalid referral code" });
    }

    res.status(200).json({
      valid: true,
      takesPercentage: influencer.influencersTakesPercentage,
      discount: influencer.influencersTakesPercentage ? 0 : influencer.percentage,
    });
  } catch (err: any) {
    console.error("VALIDATE REFERRAL ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// In your ticket controller
export const getTransactionByReference = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;

    const transaction = await transactionHistoryModel
      .findOne({ txnId: `TXN-${reference}` })
      .populate("event");

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Webhook might still be processing — poll-friendly response
    if (transaction.status !== "completed") {
      return res.status(202).json({ 
        message: "Payment still processing",
        status: transaction.status 
      });
    }

    const event = await eventModel.findById(transaction.event);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const ticket = event.tickets.find(
      (t: any) => t._id.toString() === transaction.ticket.toString()
    );

    res.status(200).json({
      success: true,
      transaction,
      event: {
        title: event.eventDetails.eventTitle,
        venue: event.eventDetails.venue,
        address: event.eventDetails.address,
        startDate: event.eventDetails.startDate,
        endDate: event.eventDetails.endDate,
        theme: event.eventDetails.eventTheme,
      },
      ticket: {
        ticketName: ticket?.ticketName,
        price: ticket?.price,
        currency: ticket?.currency,
      },
    });
  } catch (err: any) {
    console.error("FETCH TRANSACTION ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};