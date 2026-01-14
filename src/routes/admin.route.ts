import  express  from 'express';
import { validateCreateAccount, validateLogin } from '../validators/admin.validation';
import { createAccount, loginAccount, verifyLoginOtp } from '../controllers/admin.controller';


const router = express.Router();

router.post("/create-account", validateCreateAccount, createAccount);
router.post("/login", validateLogin, loginAccount);
router.post("/verify-otp", verifyLoginOtp);




export default router;