import transactionHistoryModel from "../models/transactionHistory.model";

const REVENUE_STATUSES = ["completed", "manually_verified"];

/**
 * Cocktail QR codes are shared, not per-drink: one code represents
 * the buyer's whole cocktail order for the event, and can be scanned
 * more than once as they come back for another round. This mirrors
 * the check-in service's code parsing (URL, bare query string, or a
 * bare txnId) for consistency.
 */
function parseTxnIdFromCode(raw: string): string | undefined {
  const trimmed = raw.trim();

  try {
    const url = new URL(trimmed);
    const txnId = url.searchParams.get("txnId");
    if (txnId) return txnId;
  } catch {
    // not a URL — fall through
  }

  if (trimmed.includes("txnId=")) {
    const params = new URLSearchParams(trimmed.replace(/^\?/, ""));
    const txnId = params.get("txnId");
    if (txnId) return txnId;
  }

  // Last resort: treat the whole scanned value as a bare txnId.
  return trimmed || undefined;
}

export class CocktailRedemptionService {
  /**
   * Read-only lookup — shows what's still owed on this cocktail order
   * without redeeming anything. Used to populate the redemption UI
   * before staff confirm how many of each drink to hand over.
   */
  async lookupOrder(code: string) {
    const txnId = parseTxnIdFromCode(code);
    if (!txnId) {
      const err: any = new Error("Could not read a cocktail order from that code");
      err.statusCode = 400;
      throw err;
    }

    const transaction = await transactionHistoryModel
      .findOne({ txnId })
      .populate("event", "eventDetails.eventTitle");

    if (!transaction) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (!REVENUE_STATUSES.includes(transaction.status)) {
      const err: any = new Error(`This order's payment is ${transaction.status}, not confirmed`);
      err.statusCode = 400;
      throw err;
    }

    const cocktailOrder = (transaction as any).cocktailOrder;
    if (!cocktailOrder || !cocktailOrder.items?.length) {
      const err: any = new Error("This order has no cocktails attached");
      err.statusCode = 404;
      throw err;
    }

    return {
      txnId: transaction.txnId,
      eventTitle: (transaction.event as any)?.eventDetails?.eventTitle,
      buyerName: transaction.buyers[0]?.fullName,
      items: cocktailOrder.items.map((item: any) => ({
        cocktailId: item.cocktail.toString(),
        name: item.name,
        quantity: item.quantity,
        redeemedQuantity: item.redeemedQuantity,
        remaining: item.quantity - item.redeemedQuantity,
      })),
    };
  }

  /**
   * Redeems some or all of the remaining drinks on this order.
   * Supports partial redemption — a buyer with 5 cocktails can come
   * back for separate rounds, and each visit only needs to cover the
   * drinks being handed over right now.
   */
  async redeem(
    code: string,
    redemptions: { cocktailId: string; quantity: number }[],
    redeemedBy: string
  ) {
    const txnId = parseTxnIdFromCode(code);
    if (!txnId) {
      const err: any = new Error("Could not read a cocktail order from that code");
      err.statusCode = 400;
      throw err;
    }

    const transaction = await transactionHistoryModel.findOne({ txnId });
    if (!transaction) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (!REVENUE_STATUSES.includes(transaction.status)) {
      const err: any = new Error(`This order's payment is ${transaction.status}, not confirmed`);
      err.statusCode = 400;
      throw err;
    }

    const cocktailOrder = (transaction as any).cocktailOrder;
    if (!cocktailOrder || !cocktailOrder.items?.length) {
      const err: any = new Error("This order has no cocktails attached");
      err.statusCode = 404;
      throw err;
    }

    // Validate every requested redemption BEFORE applying any of them,
    // so a partially-invalid request doesn't redeem some items and
    // reject others.
    for (const redemption of redemptions) {
      const item = cocktailOrder.items.find(
        (i: any) => i.cocktail.toString() === redemption.cocktailId
      );
      if (!item) {
        const err: any = new Error(`Cocktail not found on this order: ${redemption.cocktailId}`);
        err.statusCode = 404;
        throw err;
      }
      const remaining = item.quantity - item.redeemedQuantity;
      if (redemption.quantity > remaining) {
        const err: any = new Error(
          `Only ${remaining} "${item.name}" left to redeem on this order`
        );
        err.statusCode = 400;
        throw err;
      }
      if (redemption.quantity <= 0) {
        const err: any = new Error("Redemption quantity must be greater than 0");
        err.statusCode = 400;
        throw err;
      }
    }

    for (const redemption of redemptions) {
      const item = cocktailOrder.items.find(
        (i: any) => i.cocktail.toString() === redemption.cocktailId
      );
      item.redeemedQuantity += redemption.quantity;
    }

    await transaction.save();

    return {
      txnId: transaction.txnId,
      items: cocktailOrder.items.map((item: any) => ({
        cocktailId: item.cocktail.toString(),
        name: item.name,
        quantity: item.quantity,
        redeemedQuantity: item.redeemedQuantity,
        remaining: item.quantity - item.redeemedQuantity,
      })),
    };
  }
}

export default new CocktailRedemptionService();