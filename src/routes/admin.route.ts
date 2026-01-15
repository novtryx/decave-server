import  express  from 'express';
import { validateCreateAccount, validateLogin } from '../validators/admin.validation';
import { createAccount, getUserSessions, loginAccount, logout, resendLoginOtp, revokeAllOtherSessions, revokeSession, verifyLoginOtp } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';


const router = express.Router();

router.post("/create-account", validateCreateAccount, createAccount);
router.post("/login", validateLogin, loginAccount);
router.post("/verify-otp", verifyLoginOtp);
router.post("/resend-otp", resendLoginOtp);
router.post("/verify-otp", verifyLoginOtp);
router.post("/logout", authenticate, logout);

// Session management routes
router.get("/sessions", authenticate, getUserSessions);
router.delete("/sessions", authenticate, revokeSession);
router.delete("/sessions/others", authenticate, revokeAllOtherSessions);




export default router;