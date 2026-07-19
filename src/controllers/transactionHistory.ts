import { Request, Response } from "express";
import transactionService from "../services/transaction.service";
import transactionHistoryModel from "../models/transactionHistory.model";
import eventModel from "../models/event.model";
import { InfluencerModel } from "../models/influencer.model";
import { generateTicketPDF, ticketEmailTemplate } from "../utils/ticketEmailTemplate";
import { transporter } from "../config/mailer";
import { recordAuditLog } from "../utils/auditLog";
import { AuthRequest } from "../middleware/auth.middleware";

const INFLUENCER_PERCENTAGE = 10;

export const getAllTransactionHistory = async (req:Request, res:Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const history = await transactionService.getAllTransactions(page, limit)

        res.status(200).json({
            message: "transactions fetched successfully",
            success: true,
            data: history.history,
            stats: history.totals,
            pagination: history.pagination
        })
        
    } catch (error:any) {
        res.status(500).json({
            message: error.message,
            success: false,
            
        })
    }
}

export const getEventsTransactionSummary = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await transactionService.getEventsTransactionSummary(page, limit);

        res.status(200).json({
            message: "Event transaction summary fetched successfully",
            success: true,
            data: result.events,
            pagination: result.pagination
        });
    } catch (error: any) {
        res.status(500).json({
            message: error.message,
            success: false
        });
    }
}

export const getEventTransactionHistory = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;

        if (typeof eventId !== "string") {
            return res.status(400).json({
                message: "A single eventId is required",
                success: false
            });
        }
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await transactionService.getTransactionsByEvent(eventId, page, limit);

        res.status(200).json({
            message: "Transactions for event fetched successfully",
            success: true,
            event: result.event,
            data: result.history,
            stats: result.totals,
            pagination: result.pagination
        });
    } catch (error: any) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            message: error.message,
            success: false
        });
    }
}
// ─────────────────────────────────────────────
// PENDING PAYMENT AGING
// ─────────────────────────────────────────────
export const getPendingPaymentAging = async (req: Request, res: Response) => {
    try {
        const result = await transactionService.getPendingAging();
        res.status(200).json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─────────────────────────────────────────────
// ABANDONED CHECKOUT RECOVERY LIST
// ─────────────────────────────────────────────
export const getAbandonedCheckouts = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const thresholdMinutes = parseInt(req.query.thresholdMinutes as string) || 30;

        const result = await transactionService.getAbandonedCheckouts(page, limit, thresholdMinutes);

        res.status(200).json({
            success: true,
            data: result.data,
            pagination: result.pagination
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─────────────────────────────────────────────
// MANUALLY VERIFY A TRANSACTION (e.g. confirmed bank transfer)
// Mirrors the Paystack webhook's "mark paid" side effects: deduct
// inventory, credit influencer commission, email tickets — plus an
// audit log entry, since this bypasses the payment gateway entirely.
// NOTE: gated only by `authenticate` for now. Restricting this to a
// Finance Admin / Super Admin role is Phase 5 (roles & permissions).
// ─────────────────────────────────────────────
export const manuallyVerifyTransaction = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { note, paymentChannel } = req.body;

        const transaction = await transactionHistoryModel.findById(id);
        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        if (["completed", "manually_verified"].includes(transaction.status)) {
            return res.status(400).json({ success: false, message: "Transaction is already marked as paid" });
        }
        if (["refunded", "cancelled"].includes(transaction.status)) {
            return res.status(400).json({ success: false, message: `Cannot verify a ${transaction.status} transaction` });
        }

        const event = await eventModel.findById(transaction.event);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        const ticket = event.tickets.find((t: any) => t._id.toString() === transaction.ticket.toString());
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found on event" });
        }

        if (transaction.buyers.length > ticket.availableQuantity) {
            return res.status(400).json({
                success: false,
                message: "Not enough ticket inventory left to verify this order"
            });
        }

        transaction.status = "manually_verified";
        transaction.paymentChannel = paymentChannel || "manual_bank_transfer";
        transaction.manualVerification = {
            verifiedBy: req.user!.id as any,
            verifiedAt: new Date(),
            note,
        };
        await transaction.save();

        // Deduct inventory, same as the webhook path
        ticket.availableQuantity = Math.max(ticket.availableQuantity - transaction.buyers.length, 0);
        await event.save();
        await transactionService.invalidateDashboardCache();

        // Influencer commission — always applies now, calculated off the
        // canonical (undiscounted) ticket price, same as the webhook path
        if (transaction.influencer) {
            const influencer = await InfluencerModel.findById(transaction.influencer.toString());
            if (influencer) {
                const baseAmount = transaction.buyers.length * ticket.price;
                const commission = (INFLUENCER_PERCENTAGE / 100) * baseAmount;
                await InfluencerModel.findByIdAndUpdate(transaction.influencer, {
                    $inc: { amount: commission, buyers: transaction.buyers.length },
                });
            }
        }

        // Ticket emails
        for (const buyer of transaction.buyers) {
            try {
                const pdfBuffer = await generateTicketPDF({ buyer, event: event.eventDetails, ticket, transaction });
                await transporter.sendMail({
                    from: '"DeCave Ticket " <info@decavemgt.com>',
                    to: buyer.email,
                    subject: `Your Ticket for ${event.eventDetails.eventTitle}`,
                    html: ticketEmailTemplate({ buyer, event: event.eventDetails, ticket, transaction }),
                    attachments: [{
                        filename: `Ticket-${buyer.ticketId}.pdf`,
                        content: pdfBuffer,
                        contentType: "application/pdf",
                    }],
                });
            } catch (err) {
                console.error("Email failed for:", buyer.email, err);
            }
        }

        await recordAuditLog({
            action: "transaction.manual_verify",
            performedBy: req.user!.id,
            targetType: "TransactionHistory",
            targetId: transaction._id.toString(),
            metadata: { txnId: transaction.txnId, note, paymentChannel: transaction.paymentChannel, buyersCount: transaction.buyers.length },
        });

        return res.status(200).json({ success: true, message: "Transaction verified and marked as paid", data: transaction });
    } catch (error: any) {
        console.error("MANUAL VERIFY ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ─────────────────────────────────────────────
// REFUND A TRANSACTION
// Marks it refunded and (by default) restocks the ticket inventory.
// Does not call out to Paystack to actually move money — that's a
// manual/offline step; this records the outcome and keeps inventory
// and reporting in sync.
// ─────────────────────────────────────────────
export const refundTransaction = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { amount, reason, restock = true } = req.body;

        const transaction = await transactionHistoryModel.findById(id);
        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        if (!["completed", "manually_verified"].includes(transaction.status)) {
            return res.status(400).json({ success: false, message: "Only completed transactions can be refunded" });
        }

        const event = await eventModel.findById(transaction.event);
        const ticket = event?.tickets.find((t: any) => t._id.toString() === transaction.ticket.toString());
        const refundAmount = typeof amount === "number"
            ? amount
            : (ticket ? ticket.price * transaction.buyers.length : 0);

        transaction.status = "refunded";
        transaction.refund = {
            amount: refundAmount,
            reason,
            refundedBy: req.user!.id as any,
            refundedAt: new Date(),
        };
        await transaction.save();

        if (restock && event && ticket) {
            ticket.availableQuantity = Math.min(
                ticket.availableQuantity + transaction.buyers.length,
                ticket.initialQuantity
            );
            await event.save();
        }
        await transactionService.invalidateDashboardCache();

        await recordAuditLog({
            action: "transaction.refund",
            performedBy: req.user!.id,
            targetType: "TransactionHistory",
            targetId: transaction._id.toString(),
            metadata: { txnId: transaction.txnId, amount: refundAmount, reason, restocked: !!restock },
        });

        return res.status(200).json({ success: true, message: "Transaction refunded", data: transaction });
    } catch (error: any) {
        console.error("REFUND ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ─────────────────────────────────────────────
// CANCEL A (PENDING/FAILED) TRANSACTION
// For stuck, duplicate, or manually-abandoned orders. Does not
// restock inventory since a pending/failed transaction never
// deducted it in the first place.
// ─────────────────────────────────────────────
export const cancelTransaction = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const transaction = await transactionHistoryModel.findById(id);
        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        if (["completed", "manually_verified", "refunded", "cancelled"].includes(transaction.status)) {
            return res.status(400).json({ success: false, message: `Cannot cancel a ${transaction.status} transaction` });
        }

        transaction.status = "cancelled";
        transaction.cancellation = {
            reason,
            cancelledBy: req.user!.id as any,
            cancelledAt: new Date(),
        };
        await transaction.save();
        await transactionService.invalidateDashboardCache();

        await recordAuditLog({
            action: "transaction.cancel",
            performedBy: req.user!.id,
            targetType: "TransactionHistory",
            targetId: transaction._id.toString(),
            metadata: { txnId: transaction.txnId, reason },
        });

        return res.status(200).json({ success: true, message: "Transaction cancelled", data: transaction });
    } catch (error: any) {
        console.error("CANCEL ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}