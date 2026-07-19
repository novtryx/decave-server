import { Response } from "express";
import cocktailRedemptionService from "../services/cocktailRedemption.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const lookupCocktailOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ success: false, message: "code is required" });
    }

    const data = await cocktailRedemptionService.lookupOrder(code);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const redeemCocktails = async (req: AuthRequest, res: Response) => {
  try {
    const { code, redemptions } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ success: false, message: "code is required" });
    }
    if (!Array.isArray(redemptions) || redemptions.length === 0) {
      return res.status(400).json({ success: false, message: "redemptions must be a non-empty array" });
    }

    const data = await cocktailRedemptionService.redeem(code, redemptions, req.user!.id);
    res.status(200).json({ success: true, message: "Cocktails redeemed", data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};