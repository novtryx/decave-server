import { Request, Response } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import paystack from "../services/paystack.service";
import transactionHistoryModel from "../models/transactionHistory.model";
import eventModel from "../models/event.model";

const generateBuyerTicketId = (ticketName: string) => {
  const prefix = ticketName.slice(0, 3).toUpperCase();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${random}`;
};

export const purchaseTicket = async (req: Request, res: Response) => {
  try {
    const { eventId, ticketId, buyers, amount } = req.body;

    if (!buyers || buyers.length === 0) {
      return res.status(400).json({ message: "Buyers required" });
    }

    // 1️⃣ Find event
    const event = await eventModel.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // 2️⃣ Find ticket in event
    const ticket = event.tickets.find(
        (t: any) => t?._id?.toString() === ticketId
        );

        if (!ticket) {
            return res.status(404).json({
                message: "Ticket not found in event"
            });
        }

    // 3️⃣ Total quantity
    const totalQuantity = buyers.reduce(
      (sum: number, b: any) => sum + (b.quantity || 1),
      0
    );

    if (totalQuantity > ticket.availableQuantity) {
      return res.status(400).json({ message: "Not enough tickets available" });
    }

    // 4️⃣ Generate TXN reference (TEMP, replaced after verification)
    const rawRef = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const txnId = `TXN-${rawRef}`;

    // 5️⃣ Expand buyers → individual tickets
    const expandedBuyers = [];

    for (const buyer of buyers) {
      const qty = buyer.quantity || 1;

      for (let i = 0; i < qty; i++) {
        const buyerTicketId = generateBuyerTicketId(event.eventDetails.eventTitle);
        // const qrPayload = `EVENT:${event.eventDetails.eventTitle}|TXN:${txnId}|TICKET:${buyerTicketId}`;
        const qrPayload =`https://decave-demo.vercel.app/ticket?txnId=${txnId}&ticketId=${buyerTicketId}`
        const qrCode = await QRCode.toDataURL(qrPayload);


        expandedBuyers.push({
          fullName: buyer.fullName,
          email: buyer.email,
          phoneNumber: buyer.phoneNumber,
          ticketId: buyerTicketId,
          checkedIn: false,
          qrCode
        });
      }
    }

    // 6️⃣ Create transaction
    const transaction = await transactionHistoryModel.create({
      txnId,                 // ✅ TXN-{ref}
      event: eventId,
      ticket: ticketId,      // ✅ ObjectId of event ticket
      buyers: expandedBuyers,
      status: "pending",
      paystackId: "INIT"
    });

    // 7️⃣ Init Paystack
    const response = await paystack.post("/transaction/initialize", {
      email: buyers[0].email,
      amount: amount * 100,
      reference: rawRef,
      metadata: {
        txnId,
        transactionId: transaction._id
      },
      callback_url: "http://localhost:3000/payment-success"
    });

    res.status(200).json({
      authorization_url: response.data.data.authorization_url,
      txnId
    });

  } catch (err) {
    console.error("PURCHASE ERROR:", err);
    res.status(500).json({ message: "Ticket purchase failed", err });
  }
};
