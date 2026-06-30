import  express  from 'express';
import { getAllTransactionHistory, getEventsTransactionSummary, getEventTransactionHistory } from '../controllers/transactionHistory';
import { authenticate } from '../middleware/auth.middleware';
const router = express.Router()

// router.get("/", authenticate, getAllTransactionHistory)
// router.get("/events", authenticate, getEventsTransactionSummary)
// router.get("/events/:eventId", authenticate, getEventTransactionHistory)

router.get("/", getAllTransactionHistory)
router.get("/events",  getEventsTransactionSummary)
router.get("/events/:eventId",  getEventTransactionHistory)


export default router;