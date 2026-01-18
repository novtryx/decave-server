
import  express  from 'express';
import { getAllTransactionHistory } from '../controllers/transactionHistory';
import { authenticate } from '../middleware/auth.middleware';
const router = express.Router()

router.get("/", authenticate, getAllTransactionHistory)



export default router;