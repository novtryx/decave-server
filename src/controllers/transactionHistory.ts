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
            pagination: history.pagination
        })
        
    } catch (error:any) {
        res.status(500).json({
            message: error.message,
            success: false,
            
        })
    }
}