import { Request, Response } from "express";
import crmService, { CustomerFilters } from "../services/crm.service";

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const filters: CustomerFilters = {
      search: (req.query.search as string) || undefined,
      eventId: (req.query.eventId as string) || undefined,
      ticketTierCategory: (req.query.ticketTierCategory as string) || undefined,
      minSpend: req.query.minSpend ? Number(req.query.minSpend) : undefined,
      maxSpend: req.query.maxSpend ? Number(req.query.maxSpend) : undefined,
      attendanceStatus: (req.query.attendanceStatus as "checked_in" | "never_checked_in") || undefined,
      tag: (req.query.tag as string) || undefined,
    };

    const result = await crmService.getCustomers(filters, page, limit);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomerDetail = async (req: Request, res: Response) => {
  try {
    const email = String(req.params.email);
    const data = await crmService.getCustomerDetail(email);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const setCustomerTags = async (req: Request, res: Response) => {
  try {
    const email = String(req.params.email);
    const { tags, notes } = req.body;

    if (tags !== undefined && !Array.isArray(tags)) {
      return res.status(400).json({ success: false, message: "tags must be an array of strings" });
    }

    const updated = await crmService.setCustomerTags(email, tags || [], notes);
    res.status(200).json({ success: true, message: "Customer tags updated", data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};