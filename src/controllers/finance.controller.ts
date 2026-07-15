import { Response } from "express";
import financeService from "../services/finance.service";
import { recordAuditLog } from "../utils/auditLog";
import { AuthRequest } from "../middleware/auth.middleware";

export const createFinanceEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, type, category, amount, currency, description, date } = req.body;

    if (!type || !["credit", "debit"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'credit' or 'debit'" });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: "category is required" });
    }

    const entry = await financeService.createEntry(
      { eventId, type, category, amount: Number(amount), currency, description, date },
      req.user!.id
    );

    await recordAuditLog({
      action: `finance.${type}.create`,
      performedBy: req.user!.id,
      targetType: "FinanceEntry",
      targetId: entry._id.toString(),
      metadata: { eventId: eventId || null, category, amount },
    });

    res.status(201).json({ success: true, message: "Finance entry recorded", data: entry });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const updateFinanceEntry = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { eventId, type, category, amount, currency, description, date } = req.body;

    const entry = await financeService.updateEntry(id, {
      eventId,
      type,
      category,
      amount: amount !== undefined ? Number(amount) : undefined,
      currency,
      description,
      date,
    });

    await recordAuditLog({
      action: "finance.entry.update",
      performedBy: req.user!.id,
      targetType: "FinanceEntry",
      targetId: id,
      metadata: req.body,
    });

    res.status(200).json({ success: true, message: "Finance entry updated", data: entry });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const deleteFinanceEntry = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    await financeService.deleteEntry(id);

    await recordAuditLog({
      action: "finance.entry.delete",
      performedBy: req.user!.id,
      targetType: "FinanceEntry",
      targetId: id,
    });

    res.status(200).json({ success: true, message: "Finance entry deleted" });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const getFinanceEntries = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await financeService.getEntries(
      {
        eventId: (req.query.eventId as string) || undefined,
        type: (req.query.type as "credit" | "debit") || undefined,
        category: (req.query.category as string) || undefined,
        from: (req.query.from as string) || undefined,
        to: (req.query.to as string) || undefined,
      },
      page,
      limit
    );

    res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEventFinanceSummary = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = String(req.params.eventId);
    const data = await financeService.getEventFinanceSummary(eventId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const getFinanceOverview = async (req: AuthRequest, res: Response) => {
  try {
    const data = await financeService.getFinanceOverview();
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};