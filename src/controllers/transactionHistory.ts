import { Request, Response } from "express";
import transactionService from "../services/transaction.service";

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