import  express  from 'express';
import {
  getAllTransactionHistory,
  getEventsTransactionSummary,
  getEventTransactionHistory,
  getPendingPaymentAging,
  getAbandonedCheckouts,
  manuallyVerifyTransaction,
  refundTransaction,
  cancelTransaction,
} from '../controllers/transactionHistory';
import { authenticate } from '../middleware/auth.middleware';
const router = express.Router()

// router.get("/", authenticate, getAllTransactionHistory)
// router.get("/events", authenticate, getEventsTransactionSummary)
// router.get("/events/:eventId", authenticate, getEventTransactionHistory)

router.get("/", getAllTransactionHistory)
router.get("/events",  getEventsTransactionSummary)

// NOTE: registered before "/events/:eventId" so "pending-aging" and
// "abandoned" aren't swallowed as an :eventId param.
router.get("/pending-aging", authenticate, getPendingPaymentAging)
router.get("/abandoned", authenticate, getAbandonedCheckouts)

router.get("/events/:eventId",  getEventTransactionHistory)

router.patch("/:id/manual-verify", authenticate, manuallyVerifyTransaction)
router.patch("/:id/refund", authenticate, refundTransaction)
router.patch("/:id/cancel", authenticate, cancelTransaction)


export default router;