import { Response } from "express";
import checkInService from "../services/checkin.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const scanCheckIn = async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ success: false, message: "code is required" });
    }

    const result = await checkInService.scan(code, req.user!.id);

    res.status(200).json({
      success: true,
      message: result.duplicate
        ? `Already checked in at ${new Date(result.buyer.checkedInAt).toLocaleTimeString()}`
        : "Checked in successfully",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const manualCheckIn = async (req: AuthRequest, res: Response) => {
  try {
    const { txnId, ticketId } = req.body;
    if (!txnId || !ticketId) {
      return res.status(400).json({ success: false, message: "txnId and ticketId are required" });
    }

    const result = await checkInService.manualCheckIn(txnId, ticketId, req.user!.id);

    res.status(200).json({
      success: true,
      message: result.duplicate
        ? `Already checked in at ${new Date(result.buyer.checkedInAt).toLocaleTimeString()}`
        : "Checked in successfully",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const searchAttendees = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = String(req.params.eventId);
    const query = String(req.query.query || "");

    if (!query.trim()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const results = await checkInService.search(eventId, query);
    res.status(200).json({ success: true, data: results });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const getLiveDoorMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = String(req.params.eventId);
    const data = await checkInService.getLiveDoorMetrics(eventId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const getAttendanceExport = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = String(req.params.eventId);
    const data = await checkInService.getAttendanceExport(eventId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};