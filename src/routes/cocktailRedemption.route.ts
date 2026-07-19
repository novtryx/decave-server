import express from "express";
import { lookupCocktailOrder, redeemCocktails } from "../controllers/cocktailRedemption.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/lookup", authenticate, lookupCocktailOrder);
router.post("/redeem", authenticate, redeemCocktails);

export default router;