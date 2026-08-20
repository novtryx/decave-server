import { Request, Response } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import paystack from "../services/paystack.service";
import transactionHistoryModel from "../models/transactionHistory.model";
import eventModel from "../models/event.model";
import transactionService from "../services/transaction.service";
import { InfluencerModel } from "../models/influencer.model";
import { generateTicketPDF, ticketEmailTemplate } from "../utils/ticketEmailTemplate";
import { generateCocktailPDF, cocktailEmailTemplate } from "../utils/cocktailEmailTemplate";
import { client as zeptoMailClient } from "../config/mailer";
import newsletterModel from "../models/newsletter.model";


const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
// Every valid referral now applies BOTH sides at once: the buyer gets
// this much off, and the influencer earns this much commission off the
// original (pre-discount) price. Previously this was either/or, gated
// by a per-influencer "takes percentage" toggle — that toggle is no
// longer consulted here. Only affects NEW purchases from this point
// forward; already-completed transactions are untouched.
const REFERRAL_DISCOUNT_PERCENTAGE = 10;
const INFLUENCER_COMMISSION_PERCENTAGE = 10;
// Fixed platform-wide policy — every cocktail add-on is always 20%
// off its listed menu price at checkout, independent of any referral.
const COCKTAIL_DISCOUNT_PERCENTAGE = 20;

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
    const { eventId, ticketId, buyers, amount, referralCode, groupTicket = false, cocktails, sessionRef } = req.body;

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

    // 2️⃣b Enforce ticket sale window, if one is configured
    const now = new Date();
    if ((ticket as any).saleStartDate && now < new Date((ticket as any).saleStartDate)) {
      return res.status(400).json({ message: "Ticket sales have not started yet" });
    }
    if ((ticket as any).saleEndDate && now > new Date((ticket as any).saleEndDate)) {
      return res.status(400).json({ message: "Ticket sales have ended" });
    }

    // 3️⃣ Check availability
    const totalQuantity = buyers.reduce(
      (sum: number, b: any) => sum + (b.quantity || 1),
      0
    );
    if (totalQuantity > ticket.availableQuantity) {
      return res.status(400).json({ message: "Not enough tickets available" });
    }

    // 4️⃣ Resolve referral code → buyer always gets 10% off, influencer
    // always earns 10% commission — both apply together on every valid
    // referral. Commission is calculated off the ORIGINAL (undiscounted)
    // amount so the buyer's discount never eats into the influencer's cut;
    // that's why the pre-discount amount is stored on the transaction below.
    let finalAmount = amount;
    let influencer = null;

    if (referralCode) {
      influencer = await InfluencerModel.findOne({
        referralCode: referralCode.toUpperCase().trim(),
      });

      if (influencer) {
        const discount = (REFERRAL_DISCOUNT_PERCENTAGE / 100) * amount;
        finalAmount = amount - discount;
      }
    }

    // 4️⃣b Resolve cocktail add-ons, if any were selected. 20% off is a
    // fixed platform policy, applied regardless of any referral code.
    // Stock isn't deducted here — same pattern as tickets — only once
    // the webhook confirms payment succeeded.
    const cocktailItemsRaw: { cocktailId: string; quantity: number }[] = Array.isArray(cocktails)
      ? cocktails.filter((c: any) => c?.cocktailId && c?.quantity > 0)
      : [];

    let cocktailDiscountedTotal = 0;
    const resolvedCocktailItems: {
      cocktail: any;
      name: string;
      unitPrice: number;
      discountedUnitPrice: number;
      quantity: number;
    }[] = [];

    for (const item of cocktailItemsRaw) {
      const cocktailDoc = (event as any).cocktails.find(
        (c: any) => c._id.toString() === item.cocktailId
      );
      if (!cocktailDoc) {
        return res.status(404).json({ message: `Cocktail not found: ${item.cocktailId}` });
      }
      if (item.quantity > cocktailDoc.availableQuantity) {
        return res.status(400).json({
          message: `Not enough "${cocktailDoc.name}" available (${cocktailDoc.availableQuantity} left)`,
        });
      }

      const discountedUnitPrice = cocktailDoc.price * (1 - COCKTAIL_DISCOUNT_PERCENTAGE / 100);
      cocktailDiscountedTotal += discountedUnitPrice * item.quantity;

      resolvedCocktailItems.push({
        cocktail: cocktailDoc._id,
        name: cocktailDoc.name,
        unitPrice: cocktailDoc.price,
        discountedUnitPrice,
        quantity: item.quantity,
      });
    }


    const rawRef = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const txnId = `TXN-${rawRef}`;

    // 5️⃣b Cocktail QR — one shared code for the whole cocktail order,
    // scanned at the bar to redeem (same URL-with-params pattern as
    // ticket QR codes, so the redemption endpoint can parse it the
    // same way).
    let cocktailQrCode: string | undefined;
    if (resolvedCocktailItems.length > 0) {
      const cocktailQrPayload = `https://decavemgt.com/cocktail?txnId=${txnId}`;
      cocktailQrCode = await QRCode.toDataURL(cocktailQrPayload);
    }

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

    // 7️⃣ Create pending transaction (store influencer id + original,
    // pre-discount amount, and any cocktail order, if present)
    const transaction = await transactionHistoryModel.create({
      txnId,
      event: eventId,
      ticket: ticketId,
      buyers: expandedBuyers,
      status: "pending",
      paystackId: "INIT",
      originalAmount: amount,
      // Optional — ties this purchase back to the PageVisit that led
      // to it, for the traffic-source conversion breakdown. Absent
      // if the visit-tracking call never fired (e.g. ad blocker) or
      // this checkout didn't originate from an event page.
      ...(sessionRef && typeof sessionRef === "string" && { sessionRef }),
      ...(influencer && { influencer: influencer._id }),
      ...(resolvedCocktailItems.length > 0 && {
        cocktailOrder: {
          items: resolvedCocktailItems.map((item) => ({ ...item, redeemedQuantity: 0 })),
          totalAmount: cocktailDiscountedTotal,
          qrCode: cocktailQrCode,
        },
      }),
    });

    // 8️⃣ Init Paystack with the (possibly discounted) ticket amount
    // PLUS the cocktail add-on total — one single charge for the
    // whole order.
    const chargeableAmount = finalAmount + cocktailDiscountedTotal;
    const paystackFee = calculatePaystackCharge(chargeableAmount);
    const totalCharge = chargeableAmount + paystackFee;

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

    // 4️⃣b Deduct cocktail stock, if this order included any
    if ((transaction as any).cocktailOrder?.items?.length > 0) {
      for (const item of (transaction as any).cocktailOrder.items) {
        const cocktailDoc = (event_ as any).cocktails.find(
          (c: any) => c._id.toString() === item.cocktail.toString()
        );
        if (cocktailDoc) {
          cocktailDoc.availableQuantity = Math.max(
            cocktailDoc.availableQuantity - item.quantity,
            0
          );
        }
      }
    }

    await event_.save();
    await transactionService.invalidateDashboardCache();

    // 5️⃣ Handle influencer commission — always applies now (the buyer's
    // discount was already applied at checkout), calculated off the
    // ORIGINAL pre-discount amount so the referral discount doesn't
    // shrink the influencer's cut.
   if (transaction.influencer) {
  const influencer = await InfluencerModel.findById(transaction.influencer.toString());

  console.log("Influencer found by string:", influencer);
  if (influencer) {
    const baseAmount = (transaction as any).originalAmount ?? data.amount / 100;
    const commission = (INFLUENCER_COMMISSION_PERCENTAGE / 100) * baseAmount;

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

        await zeptoMailClient.sendMail({
          from: { address: "info@decavemgt.com", name: "DeCave Ticket" },
          to: [{ email_address: { address: buyer.email, name: buyer.fullName } }],
          subject: `Your Ticket for ${event_.eventDetails.eventTitle}`,
          htmlbody: ticketEmailTemplate({ buyer, event: event_.eventDetails, ticket, transaction }),
          attachments: [
            {
              name: `Ticket-${buyer.ticketId}.pdf`,
              mime_type: "application/pdf",
              content: pdfBuffer.toString("base64"),
            },
          ],
        });
      } catch (err) {
        console.error("Email failed for:", buyer.email, err);
      }
    }

    // 6️⃣b Send the cocktail order PDF + email, if this order included
    // any drinks. Goes only to the primary buyer (first buyer on the
    // order) — cocktails belong to the person who checked out, not
    // every attendee on a multi-ticket order.
    const cocktailOrder = (transaction as any).cocktailOrder;
    if (cocktailOrder?.items?.length > 0) {
      const primaryBuyer = transaction.buyers[0];
      try {
        const cocktailPdfBuffer = await generateCocktailPDF({
          buyerName: primaryBuyer.fullName,
          buyerEmail: primaryBuyer.email,
          eventTitle: event_.eventDetails.eventTitle,
          eventDate: String(event_.eventDetails.startDate),
          txnId: transaction.txnId,
          qrCode: cocktailOrder.qrCode || "",
          items: cocktailOrder.items,
          totalAmount: cocktailOrder.totalAmount,
        });

        await zeptoMailClient.sendMail({
          from: { address: "info@decavemgt.com", name: "DeCave Cocktails" },
          to: [{ email_address: { address: primaryBuyer.email, name: primaryBuyer.fullName } }],
          subject: `Your Cocktail Order for ${event_.eventDetails.eventTitle}`,
          htmlbody: cocktailEmailTemplate({
            buyerName: primaryBuyer.fullName,
            eventTitle: event_.eventDetails.eventTitle,
            items: cocktailOrder.items,
            totalAmount: cocktailOrder.totalAmount,
          }),
          attachments: [
            {
              name: `Cocktail-Order-${transaction.txnId}.pdf`,
              mime_type: "application/pdf",
              content: cocktailPdfBuffer.toString("base64"),
            },
          ],
        });
      } catch (err) {
        console.error("Cocktail email failed for:", primaryBuyer.email, err);
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
    }).select("referralCode");

    console.log("Query result:", influencer);

    if (!influencer) {
      return res.status(404).json({ message: "Invalid referral code" });
    }

    // Every valid referral now applies both sides: buyer discount +
    // influencer commission, always — no more per-influencer toggle.
    res.status(200).json({
      valid: true,
      discountPercentage: REFERRAL_DISCOUNT_PERCENTAGE,
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