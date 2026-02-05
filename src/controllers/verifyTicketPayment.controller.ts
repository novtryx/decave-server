import { Request, Response } from "express";
import paystack from "../services/paystack.service";
import transactionHistoryModel from "../models/transactionHistory.model";
import eventModel from "../models/event.model";
import { transporter } from "../config/mailer";
import { generateTicketPDF, ticketEmailTemplate } from "../utils/ticketEmailTemplate";

export const verifyTicketPayment = async (req: Request, res: Response) => {
  try {
    const reference = req.params.reference;

    // 1️⃣ Verify Paystack
    const response = await paystack.get(`/transaction/verify/${reference}`);
    const data = response.data.data;

    if (data.status !== "success") {
      await transactionHistoryModel.findOneAndUpdate(
        { txnId: `TXN-${reference}` },
        { status: "failed" }
      );
      return res.status(400).json({ message: "Payment failed" });
    }

    // 2️⃣ Find transaction
    const transaction = await transactionHistoryModel.findOne({
      txnId: `TXN-${reference}`
    });

    if (!transaction || transaction.status === "completed") {
      return res.status(400).json({ message: "Invalid transaction" });
    }

    // 3️⃣ Mark completed
    transaction.status = "completed";
    transaction.paystackId = data.id;
    await transaction.save();

    // 4️⃣ Deduct ticket quantity + fetch details
    const event = await eventModel.findById(transaction.event);
    
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    
    const ticket = event.tickets.find(
      (t: any) => t._id.toString() === transaction.ticket.toString()
    );
    
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found in event" });
    }
    
    ticket.availableQuantity = Math.max(
      ticket.availableQuantity - transaction.buyers.length,
      0
    );
    
    await event.save();
    
    transaction.buyers.forEach(async (buyer: any) => {
  try {

    const pdfBuffer = await generateTicketPDF({ buyer, event: event.eventDetails, ticket, transaction });

    await transporter.sendMail({
      from: `"DCave Tickets" <no-reply@dcave.com>`,
      to: buyer.email,
      subject: `🎟 Your Ticket for ${event.eventDetails.eventTitle}`,
      html: ticketEmailTemplate({
        buyer,
        event: event.eventDetails,
        ticket,
        transaction
      }),
      attachments: [
      {
        filename: `DCave-Ticket-${buyer.ticketId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
    });
  } catch (err) {
    console.error("Email failed for:", buyer.email, err);
  }
});
    // 5️⃣ RESPONSE PAYLOAD (clean + frontend-ready)
    res.status(200).json({
      success: true,
      transaction,
      event: {
        title: event.eventDetails.eventTitle,
        venue: event.eventDetails.venue,
        address:event.eventDetails.address,
        startDate: event.eventDetails.startDate,
        endDate: event.eventDetails.endDate,
        theme: event.eventDetails.eventTheme
      },
      ticket: {
        ticketName: ticket.ticketName,
        price: ticket.price,
        currency: ticket.currency
      }
    });

  } catch (err: any) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({
      message: "Verification error",
      error: err.message
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