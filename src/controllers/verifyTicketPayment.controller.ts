import { Request, Response } from "express";
import paystack from "../services/paystack.service";
import transactionHistoryModel from "../models/transactionHistory.model";
import eventModel from "../models/event.model";
import { transporter } from "../config/mailer";
import { generateTicketPDF, ticketEmailTemplate } from "../utils/ticketEmailTemplate";
import { Resend } from "resend";
import transactionService from "../services/transaction.service";
import { confirmPaymentSucceeded } from "./purchaseTicket.controller";

// Shared response shape for a completed transaction — used both when the
// webhook already completed it before this call landed, and when this
// call is the one that completes it. Keeping this in one place means the
// frontend always gets the same payload regardless of which path won.
async function buildVerifiedResponse(transaction: any) {
  const event = await eventModel.findById(transaction.event);
  if (!event) {
    return { success: false, message: "Event not found for this transaction." };
  }

  const ticket = event.tickets.find(
    (t: any) => t._id.toString() === transaction.ticket.toString()
  );

  return {
    success: true,
    status: "completed",
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
  };
}




export const verifyTicketPayment = async (req: Request, res: Response) => {
  try {
    const reference = req.params.reference;

    // 0️⃣ This is now the frontend's primary way to find out what
    // happened to a payment, so it needs to be safe to call whether or
    // not the webhook has already landed. Check our own record first —
    // if the webhook already marked this completed, just return the
    // same success payload instead of erroring, so a race between the
    // webhook and this call never surfaces as a false "payment failed".
    const existing = await transactionHistoryModel.findOne({
      txnId: `TXN-${reference}`,
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that transaction." });
    }

    if (existing.status === "completed") {
      return res.status(200).json(await buildVerifiedResponse(existing));
    }

    // 1️⃣ Ask Paystack directly what actually happened — this is the
    // one place that gives us a real answer for a declined/failed card,
    // since our webhook only ever fires on charge.success.
    const response = await paystack.get(`/transaction/verify/${reference}`);
    const data = response.data.data;

    if (data.status !== "success") {
      await transactionHistoryModel.findOneAndUpdate(
        { txnId: `TXN-${reference}` },
        { status: "failed" }
      );
      // gateway_response is Paystack's own human-readable reason
      // ("Declined", "Insufficient Funds", "Invalid PIN", etc) — pass it
      // through so the buyer sees the real reason, not a generic one.
      return res.status(200).json({
        success: false,
        status: "failed",
        message: data.gateway_response || "Payment was not successful.",
      });
    }

    // 2️⃣ Paystack confirms this was a real success — run it through the
    // SAME completion routine the webhook uses (stock deduction for
    // tickets AND cocktails, influencer commission, ticket + cocktail
    // emails, newsletter signup). Previously this endpoint reimplemented
    // a partial version of that logic by hand, which meant a payment
    // confirmed through this path (rather than the webhook) silently
    // skipped cocktail stock deduction, influencer commission, and
    // newsletter signup. confirmPaymentSucceeded() is itself idempotent
    // (no-ops if another caller already completed it), so it's safe to
    // call here even if the webhook fires around the same time.
    await confirmPaymentSucceeded({
      transaction: existing,
      gatewayTransactionId: data.id,
      paidAmountKobo: data.amount,
    });

    const refreshed = await transactionHistoryModel.findOne({
      txnId: `TXN-${reference}`,
    });

    res.status(200).json(await buildVerifiedResponse(refreshed));

  } catch (err: any) {
    console.error("VERIFY ERROR:", err?.response?.data || err?.message || err);
    res.status(500).json({
      success: false,
      message: "We couldn't confirm your payment right now. Please check your email for a ticket, or contact support with your order reference.",
    });
  }
};



export const checkInTicket = async (req: Request, res: Response) => {
  try {
    const { txnId, ticketId } = req.query;

    if (!txnId || !ticketId) {
      return res.status(400).json({ message: "txnId and ticketId are required" });
    }

    // Find transaction
    const transaction = await transactionHistoryModel.findOne({ txnId });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Check payment status
    if (transaction.status !== "completed") {
      return res.status(400).json({ 
        message: "Payment not completed" 
      });
    }

    // Find buyer index
    const buyerIndex = transaction.buyers.findIndex(
      (b: any) => b.ticketId === ticketId
    );

    if (buyerIndex === -1) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Check if already checked in
    if (transaction.buyers[buyerIndex].checkedIn) {
      return res.status(400).json({ 
        message: "Ticket already checked in",
        checkedIn: true
      });
    }

    // Update checkedIn status
    transaction.buyers[buyerIndex].checkedIn = true;
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Ticket checked in successfully",
      ticket: {
        ticketId: transaction.buyers[buyerIndex].ticketId,
        fullName: transaction.buyers[buyerIndex].fullName,
        checkedIn: true
      }
    });

  } catch (err) {
    console.error("CHECK-IN ERROR:", err);
    res.status(500).json({ message: "Check-in failed", err });
  }
};




export const resendTicketEmail = async (req: Request, res: Response) => {
  try {
    const { ticketId, email } = req.body;

    if (!ticketId || !email) {
      return res.status(400).json({ message: "ticketId and email are required" });
    }

    // 1️⃣ Find transaction containing this ticketId
    const transaction = await transactionHistoryModel.findOne({
      "buyers.ticketId": ticketId
    });

    if (!transaction) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (transaction.status !== "completed") {
      return res.status(400).json({ message: "Payment not completed for this ticket" });
    }

    // 2️⃣ Find the specific buyer
    const buyer = transaction.buyers.find((b: any) => b.ticketId === ticketId);

    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found for this ticket" });
    }

    // 3️⃣ Fetch event and ticket details
    const event = await eventModel.findById(transaction.event);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const ticket = event.tickets.find(
      (t: any) => t._id.toString() === transaction.ticket.toString()
    );

    if (!ticket) {
      return res.status(404).json({ message: "Ticket type not found in event" });
    }

    // 4️⃣ Generate PDF and send email to the provided address
    const pdfBuffer = await generateTicketPDF({
      buyer,
      event: event.eventDetails,
      ticket,
      transaction
    });

    const result = await transporter.sendMail({
      from: '"DeCave Ticket " <info@decavemgt.com>',
      to: email, // use the provided email, not buyer.email
      subject: `Your Ticket for ${event.eventDetails.eventTitle}`,
      html: ticketEmailTemplate({
        buyer,
        event: event.eventDetails,
        ticket,
        transaction
      }),
      attachments: [
        {
          filename: `Ticket-${buyer.ticketId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    });

    console.log("Resend result:", result);

    res.status(200).json({
      success: true,
      message: `Ticket resent to ${email}`
    });

  } catch (err: any) {
    console.error("RESEND TICKET ERROR:", err);
    res.status(500).json({
      message: "Failed to resend ticket",
      error: err.message
    });
  }
};